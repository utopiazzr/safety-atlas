import {createChallenge,verifySolution,randomInt} from 'altcha-lib';
import {deriveKey} from 'altcha-lib/algorithms/web/pbkdf2';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {limits,MiB,HttpError,fail,validId,safeUrl,parseSubmission,readBytes,readJson,digest,hmac,partKey,now} from './contracts.js';
import {adminPage} from './admin.js';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json;charset=utf-8'}});
const sql=(env,query,...args)=>env.DB.prepare(query).bind(...args);
const rows=value=>value.results||[];
const bearer=request=>request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
async function clientHash(request,env){return hmac(env.INTAKE_SECRET,`ip:${Math.floor(now()/86400)}:${request.headers.get('cf-connecting-ip')||'unknown'}`);}
async function rate(env,bucket,max,seconds){const key=`rate:${bucket}:${Math.floor(now()/seconds)}`;const row=await sql(env,'INSERT INTO quotas(bucket,used,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<? RETURNING used',key,now()+seconds*2,max).first();if(!row)fail(429,'请求过于频繁，请稍后重试 / Please try again later');}
async function own(request,env,id){if(!validId(id))fail(404,'Not found');const token=bearer(request);if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Receipt key required');const row=await sql(env,'SELECT * FROM submissions WHERE id=?',id).first();if(!row||await digest(token)!==row.token_hash)fail(404,'Not found');if(row.expires_at<now())fail(410,'Submission expired');return row;}
function isOwner(request,env){const email=request.headers.get('oai-authenticated-user-email');return Boolean(request.headers.get('oai-authenticated-user-id')&&email&&env.ADMIN_EMAIL&&email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase());}
function sameOrigin(request){if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)fail(403,'Same-origin request required');}
async function automation(request,env){
 const token=bearer(request);if(!token||token.length>16000)fail(401,'GitHub OIDC identity required');
 let payload;try{({payload}=await jwtVerify(token,JWKS,{issuer:'https://token.actions.githubusercontent.com',audience:env.OIDC_AUDIENCE,algorithms:['RS256'],maxTokenAge:'10m'}));}catch{fail(401,'Invalid GitHub OIDC identity');}
 if(payload.repository_id!==env.GITHUB_REPOSITORY_ID||payload.repository!==env.GITHUB_REPOSITORY||payload.ref!=='refs/heads/main'||payload.workflow_ref!==`${env.GITHUB_REPOSITORY}/.github/workflows/cloud-intake.yml@refs/heads/main`||!['workflow_dispatch','schedule'].includes(payload.event_name))fail(403,'Workflow identity is not allowed');return payload.actor;
}
async function getStatus(env,row){const parts=rows(await sql(env,'SELECT file_id,part_number,size,digest FROM parts WHERE submission_id=? ORDER BY file_id,part_number',row.id).all());return {id:row.id,status:row.status,reason:row.reason,createdAt:row.created_at,expiresAt:row.expires_at,files:JSON.parse(row.files),parts,githubIssue:row.github_issue||null};}
async function verifyProof(value,env,client){
 if(typeof value!=='string'||value.length>12000)fail(400,'完成防刷校验后再提交 / Verification required');
 let proof;try{proof=JSON.parse(atob(value));}catch{fail(400,'Invalid verification payload');}
 const p=proof?.challenge?.parameters;
 if(!p||p.algorithm!=='PBKDF2/SHA-256'||p.cost!==5000||p.keyLength!==32||p.data?.client!==client||!p.nonce||p.nonce.length>128||!Number.isInteger(p.expiresAt)||p.expiresAt>now()+1200||p.expiresAt<=now())fail(400,'校验已失效，请重新校验 / Verification expired');
 let valid;try{valid=await verifySolution({...proof,deriveKey,hmacSignatureSecret:env.INTAKE_SECRET,hmacKeySignatureSecret:env.ALTCHA_KEY_SECRET});}catch{fail(400,'Invalid verification');}
 if(!valid.verified)fail(400,'校验未通过 / Verification failed');return p;
}
async function createSubmission(request,env,client){
 await rate(env,`submit:${client}`,20,3600);
 const input=await readJson(request),clean=parseSubmission(input),requestHash=await digest(JSON.stringify(clean));
 const existing=await sql(env,'SELECT * FROM submissions WHERE id=?',input.id).first();
 if(existing){if(existing.token_hash!==await digest(input.receiptKey)||existing.request_hash!==requestHash)fail(409,'Submission identifier already exists');return json(await getStatus(env,existing));}
 const proof=await verifyProof(input.altcha,env,client),time=now(),day=Math.floor(time/86400);
 const buckets=[{key:`sub:${client}:${day}`,amount:1,max:5,expires:time+172800},{key:`sub:global:${day}`,amount:1,max:100,expires:time+172800},{key:'storage:reserved',amount:clean.totalBytes,max:10*1024*MiB,expires:2147483647}];
 const commands=buckets.map(b=>sql(env,'INSERT OR IGNORE INTO quotas(bucket,used,expires_at) VALUES(?,0,?)',b.key,b.expires));
 commands.push(sql(env,'INSERT INTO challenges(nonce,expires_at) VALUES(?,?)',proof.nonce,proof.expiresAt));
 const condition=buckets.map(()=>'(SELECT used FROM quotas WHERE bucket=?)+?<=?').join(' AND ');
 commands.push(sql(env,`INSERT INTO submissions(id,token_hash,client_hash,payload,files,total_bytes,status,created_at,expires_at,request_hash) SELECT ?,?,?,?,?,?,'uploading',?,?,? WHERE ${condition}`,input.id,await digest(input.receiptKey),client,JSON.stringify(clean.payload),JSON.stringify(clean.files),clean.totalBytes,time,time+86400,requestHash,...buckets.flatMap(b=>[b.key,b.amount,b.max])));
 for(const b of buckets)commands.push(sql(env,'UPDATE quotas SET used=used+? WHERE bucket=? AND EXISTS(SELECT 1 FROM submissions WHERE id=?)',b.amount,b.key,input.id));
 try{await env.DB.batch(commands);}catch(e){if(String(e).includes('UNIQUE'))fail(409,'校验已使用，请重新校验 / Verification already used');throw e;}
 const row=await sql(env,'SELECT * FROM submissions WHERE id=?',input.id).first();if(!row)fail(429,'今日接收或存储配额已满，请使用项目链接或稍后再试 / Intake quota reached');return json(await getStatus(env,row),201);
}
async function uploadPart(request,env,row,fileId,partNumber){
 if(row.status!=='uploading')fail(409,'This submission no longer accepts uploads');
 const file=JSON.parse(row.files).find(f=>f.id===fileId);if(!file||!Number.isSafeInteger(partNumber)||partNumber<0||partNumber>=Math.ceil(file.size/limits.partBytes))fail(400,'Invalid file or part');
 await rate(env,`upload:${row.id}`,120,60);await rate(env,`upload-total:${row.id}`,1500,86400);
 const lease=now()+300;const locked=await sql(env,"UPDATE submissions SET lease_until=? WHERE id=? AND lease_until<? AND status='uploading' RETURNING id",lease,row.id,now()).first();if(!locked)fail(409,'Upload in progress; retry shortly');
 try{
 const expected=Math.min(limits.partBytes,file.size-partNumber*limits.partBytes),bytes=await readBytes(request,expected);if(bytes.length!==expected)fail(400,'Part length mismatch');
 const hash=await digest(bytes),key=partKey(row.id,fileId,partNumber);
 const previous=await sql(env,'SELECT digest FROM parts WHERE submission_id=? AND file_id=? AND part_number=?',row.id,fileId,partNumber).first();
 if(previous){if(previous.digest!==hash)fail(409,'文件与已上传片段不一致 / File changed');return json({digest:hash,alreadyStored:true});}
 const stored=await env.BUCKET.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},sha256:hash,customMetadata:{sha256:hash},httpMetadata:{contentType:'application/octet-stream'}});
 if(!stored){const head=await env.BUCKET.head(key);if(!head||head.size!==bytes.length||head.customMetadata?.sha256!==hash)fail(409,'Part conflict');}
 await sql(env,'INSERT OR IGNORE INTO parts(submission_id,file_id,part_number,size,digest) VALUES(?,?,?,?,?)',row.id,fileId,partNumber,bytes.length,hash).run();return json({digest:hash});
 }finally{await sql(env,'UPDATE submissions SET lease_until=0 WHERE id=? AND lease_until=?',row.id,lease).run();}
}
async function finalize(env,row){
 if(row.status!=='uploading')return json(await getStatus(env,row));
 const status=await getStatus(env,row);for(const file of status.files){const parts=status.parts.filter(p=>p.file_id===file.id);if(parts.length!==Math.ceil(file.size/limits.partBytes)||parts.reduce((n,p)=>n+p.size,0)!==file.size)fail(409,'仍有文件片段未上传 / Upload incomplete');}
 const updated=await sql(env,"UPDATE submissions SET status='submitted',expires_at=? WHERE id=? AND status='uploading' AND lease_until<? RETURNING id",now()+limits.retentionDays*86400,row.id,now()).first();if(!updated)fail(409,'An upload is still in progress');return json({id:row.id,status:'submitted',expiresAt:now()+limits.retentionDays*86400});
}
async function deleteRecord(env,row,actor='retention'){
 const locked=await sql(env,'UPDATE submissions SET lease_until=? WHERE id=? AND lease_until<? RETURNING id',now()+300,row.id,now()).first();if(!locked)fail(409,'Upload is in progress; retry later');
 const files=JSON.parse(row.files),keys=files.flatMap(file=>Array.from({length:Math.ceil(file.size/limits.partBytes)},(_,p)=>partKey(row.id,file.id,p)));
 if(keys.length)await env.BUCKET.delete(keys);
 const preserve=['accepted','exported'].includes(row.status);
 await env.DB.batch([sql(env,'DELETE FROM parts WHERE submission_id=?',row.id),preserve?sql(env,"UPDATE submissions SET payload='{}',files='[]',client_hash='',total_bytes=0,expires_at=4102444800,lease_until=0 WHERE id=?",row.id):sql(env,'DELETE FROM submissions WHERE id=?',row.id),sql(env,"UPDATE quotas SET used=MAX(0,used-?) WHERE bucket='storage:reserved'",row.total_bytes),sql(env,'INSERT INTO audit(submission_id,action,actor,reason,created_at) VALUES(?,?,?,?,?)',row.id,preserve?'purge-raw':'delete',actor,'Expired or withdrawn',now())]);
}
async function adminRoutes(request,env,path){
 const automated=path.startsWith('/api/automation/'),actor=automated?await automation(request,env):isOwner(request,env)?'site-owner':fail(403,'Maintainer sign-in required');
 if(!automated)sameOrigin(request);
 if(path==='/api/automation/cleanup'&&request.method==='POST'){
  const expired=rows(await sql(env,'SELECT * FROM submissions WHERE expires_at<? LIMIT 5',now()).all());for(const row of expired)await deleteRecord(env,row,actor);
  await env.DB.batch([sql(env,'DELETE FROM challenges WHERE expires_at<?',now()),sql(env,'DELETE FROM quotas WHERE expires_at<?',now()),sql(env,'DELETE FROM audit WHERE created_at<?',now()-90*86400)]);return json({deleted:expired.length});
 }
 if(path==='/api/automation/queue'&&request.method==='GET')return json({items:rows(await sql(env,"SELECT id FROM submissions WHERE status='accepted' ORDER BY created_at LIMIT 10").all())});
 if(path==='/api/admin/submissions'&&request.method==='GET')return json({items:rows(await sql(env,'SELECT id,payload,status,created_at,total_bytes,reason FROM submissions ORDER BY created_at DESC LIMIT 50').all()).map(r=>({...r,payload:JSON.parse(r.payload)}))});
 const match=path.match(/^\/api\/(admin|automation)\/submissions\/([a-f0-9-]+)(?:\/(decision|export|exported|files\/\d+))?$/);if(!match||!validId(match[2]))fail(404,'Not found');
 const row=await sql(env,'SELECT * FROM submissions WHERE id=?',match[2]).first();if(!row)fail(404,'Not found');const action=match[3];
 if(request.method==='GET'&&!action&&!automated)return json({...await getStatus(env,row),payload:JSON.parse(row.payload),review:row.review_json?JSON.parse(row.review_json):null,revision:await digest(row.payload)});
 if(action?.startsWith('files/')&&request.method==='GET'&&!automated){
  const file=JSON.parse(row.files).find(f=>f.id===Number(action.split('/')[1]));if(!file)fail(404,'Not found');const count=Math.ceil(file.size/limits.partBytes);let part=0,reader;
  const stream=new ReadableStream({async pull(controller){try{if(!reader){if(part>=count){controller.close();return;}const object=await env.BUCKET.get(partKey(row.id,file.id,part++));if(!object)throw Error('Missing part');reader=object.body.getReader();}const chunk=await reader.read();if(chunk.done){reader.releaseLock();reader=null;}else controller.enqueue(chunk.value);}catch{controller.error(Error('Incomplete file'));}},async cancel(){if(reader)await reader.cancel();}});
  return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(file.size),'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.path.split('/').at(-1)).replaceAll("'",'%27')}`,'X-Content-Type-Options':'nosniff'}});
 }
 if(action==='decision'&&request.method==='POST'&&!automated){
  const value=await readJson(request,16000);if(value.expectedRevision!==await digest(row.payload))fail(409,'Materials changed; reload before deciding');if(!['submitted','needs-info','accepted','rejected'].includes(value.status)||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>2000)fail(400,'Decision and reason required');
  if(['uploading','exported'].includes(row.status))fail(409,'Finish upload first, or correct an exported record through GitHub');
  let review=null;if(value.status==='accepted'){
    const r=value.review;if(!r||typeof r.title!=='string'||!r.title.trim()||r.title.length>200||typeof r.summary!=='string'||!r.summary.trim()||r.summary.length>1000||!Array.isArray(r.sources)||!r.sources.length||r.sources.length>10||r.sources.some(u=>!safeUrl(u))||!['community-report','vendor-advisory','research-poc','paper','project','model-card'].includes(r.evidenceType)||typeof r.context!=='string'||r.context.length>4000||typeof r.limitations!=='string'||r.limitations.length>4000)fail(400,'Complete the public summary, primary sources and evidence class');
    const input=JSON.parse(row.payload);review={title:r.title.trim(),summary:r.summary.trim(),sources:r.sources,evidenceType:r.evidenceType,context:r.context,limitations:r.limitations,kind:input.kind,intent:input.intent,relatedId:input.relatedId,provenance:input.provenance,reviewedAt:new Date().toISOString()};
  }
  const changed=await sql(env,"UPDATE submissions SET status=?,reason=?,review_json=? WHERE id=? AND payload=? AND status NOT IN ('uploading','exported') RETURNING id",value.status,value.reason,review?JSON.stringify(review):null,row.id,row.payload).first();if(!changed)fail(409,'Materials changed; reload before deciding');await sql(env,'INSERT INTO audit(submission_id,action,actor,reason,created_at) VALUES(?,?,?,?,?)',row.id,value.status,actor,value.reason,now()).run();return json({status:value.status});
 }
 if(action==='export'&&request.method==='GET'&&automated){if(!['accepted','exported'].includes(row.status)||!row.review_json)fail(409,'Not approved for export');return json({id:row.id,...JSON.parse(row.review_json),publicUrl:`${new URL(request.url).origin}/public/records/${row.id}`,githubIssue:row.github_issue});}
 if(action==='exported'&&request.method==='POST'&&automated){const value=await readJson(request,1000);if(!Number.isSafeInteger(value.issueNumber)||value.issueNumber<1||!['accepted','exported'].includes(row.status))fail(400,'Invalid export receipt');await sql(env,"UPDATE submissions SET status='exported',github_issue=? WHERE id=?",value.issueNumber,row.id).run();return json({ok:true});}
 fail(404,'Not found');
}
async function route(request,env){
 const url=new URL(request.url),path=url.pathname;if(path==='/api/config')return json({version:1,limits,accepting:Boolean(env.INTAKE_SECRET&&env.ALTCHA_KEY_SECRET&&env.DB&&env.BUCKET)});
 if(path==='/'&&request.method==='GET')return new Response('Safety Atlas intake service. Use https://utopiazzr.github.io/safety-atlas/ to submit.\n',{headers:{'Content-Type':'text/plain;charset=utf-8'}});
 if(path==='/admin'&&request.method==='GET'){if(!request.headers.get('oai-authenticated-user-id'))return Response.redirect(`${url.origin}/signin-with-chatgpt?return_to=%2Fadmin`,302);if(!isOwner(request,env))fail(403,'Owner access required');return adminPage();}
 if(path.startsWith('/api/admin/')||path.startsWith('/api/automation/'))return adminRoutes(request,env,path);
 if(path.startsWith('/public/records/')&&request.method==='GET'){const id=path.split('/').at(-1);if(!validId(id))fail(404,'Not found');const row=await sql(env,"SELECT review_json FROM submissions WHERE id=? AND status IN ('accepted','exported')",id).first();if(!row?.review_json)fail(404,'Not found');return json(JSON.parse(row.review_json));}
 const allowed=new Set((env.ALLOWED_ORIGINS||'').split(',').filter(Boolean));allowed.add(url.origin);const origin=request.headers.get('origin');if(!origin||!allowed.has(origin))fail(403,'Origin not allowed');
 const client=await clientHash(request,env);await rate(env,'public-global',1200,60);
 if(path==='/api/challenge'&&request.method==='GET'){await rate(env,`challenge:${client}`,12,60);await rate(env,'challenge-global',120,60);return json(await createChallenge({algorithm:'PBKDF2/SHA-256',cost:5000,counter:randomInt(150,400),deriveKey,hmacSignatureSecret:env.INTAKE_SECRET,hmacKeySignatureSecret:env.ALTCHA_KEY_SECRET,expiresAt:now()+1200,data:{client}}));}
 if(path==='/api/submissions'&&request.method==='POST')return createSubmission(request,env,client);
 const match=path.match(/^\/api\/submissions\/([a-f0-9-]+)(?:\/(complete|note|files\/\d+\/parts\/\d+))?$/);if(!match)fail(404,'Not found');
 await rate(env,`receipt:${client}`,180,60);const row=await own(request,env,match[1]),action=match[2];
 if(request.method==='GET'&&!action)return json(await getStatus(env,row));
 if(request.method==='DELETE'&&!action){if(['accepted','exported'].includes(row.status))fail(409,'Contact the maintainer to correct published evidence');await deleteRecord(env,row,'receipt-holder');return json({deleted:true});}
 if(request.method==='PUT'&&action?.startsWith('files/')){const bits=action.split('/');return uploadPart(request,env,row,Number(bits[1]),Number(bits[3]));}
 if(request.method==='POST'&&action==='complete')return finalize(env,row);
 if(request.method==='POST'&&action==='note'){if(!['submitted','needs-info'].includes(row.status))fail(409,'This record is not accepting supplements');await rate(env,`note:${row.id}`,5,3600);const body=await readJson(request,10000);if(typeof body.note!=='string'||!body.note.trim()||body.note.length>8000)fail(400,'Invalid supplement');const payload=JSON.parse(row.payload);payload.supplements=[...(payload.supplements||[]),{note:body.note.trim(),at:now()}];if(payload.supplements.length>10)fail(400,'Supplement limit reached');const changed=await sql(env,"UPDATE submissions SET payload=?,status='submitted' WHERE id=? AND payload=? AND status IN ('submitted','needs-info') RETURNING id",JSON.stringify(payload),row.id,row.payload).first();if(!changed)fail(409,'Record changed; reload before supplementing');return json({status:'submitted'});}
 fail(405,'Method not allowed');
}
export async function handle(request,env){
 const origin=request.headers.get('origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',');allowed.push(new URL(request.url).origin);let response;
 try{if(request.method==='OPTIONS'){if(!origin||!allowed.includes(origin))fail(403,'Origin not allowed');response=new Response(null,{status:204});}else response=await route(request,env);}catch(e){const known=e instanceof HttpError;response=json({error:known?e.message:'接收服务暂时不可用，请稍后重试 / Intake temporarily unavailable'},known?e.status:500);if(!known)console.error('intake-error',e.name);}
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');headers.set('X-Frame-Options','DENY');
 if(origin&&allowed.includes(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');headers.set('Access-Control-Max-Age','600');}
 return new Response(response.body,{status:response.status,headers});
}
