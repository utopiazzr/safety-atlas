export const MiB=1024*1024;
export const limits={fileBytes:512*MiB,totalBytes:1024*MiB,files:100,partBytes:8*MiB,bodyBytes:128*1024,retentionDays:30};
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new HttpError(status,message);};
export const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
export function safePath(value){
 if(typeof value!=='string'||!value.length||value.length>300||/[\x00-\x1f\x7f]/.test(value))return false;
 const path=value.replaceAll('\\','/');const parts=path.split('/');
 if(path.startsWith('/')||/^[a-z]:/i.test(path)||parts.some(p=>!p||p==='.'||p==='..'))return false;
 return !parts.some(p=>/^(node_modules|\.git|\.svn|\.ssh|\.aws|\.venv|venv|__pycache__|dist|build)$/i.test(p)||/^\.env(?:\.|$)/i.test(p)&&!/^\.env\.(example|sample)$/i.test(p)||/\.(pem|key|p12|pfx|exe|dll|msi|bat|cmd|com|scr)$/i.test(p)||/^(id_rsa|id_ed25519|credentials)$/i.test(p));
}
export function parseSubmission(input){
 if(!input||typeof input!=='object'||!validId(input.id)||typeof input.receiptKey!=='string'||!/^[a-f0-9]{64}$/.test(input.receiptKey))fail(400,'Invalid submission identity');
 const text=(key,max,required=false)=>{const value=input[key]??'';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,`Invalid ${key}`);return value.trim();};
 const note=text('note',40000),code=text('code',40000),title=text('title',200),context=text('context',8000);
 const kind=['suspicion','incident','report','attack','defense','resource'].includes(input.kind)?input.kind:'suspicion';
 const intent=['new','evidence','correction'].includes(input.intent)?input.intent:'new';
 const relatedId=text('relatedId',100);if(intent!=='new'&&!/^[a-z0-9-]+$/.test(relatedId))fail(400,'Select the related entry');
 const provenance=['unsure','observed','reported','research'].includes(input.provenance)?input.provenance:'unsure';
 const projectUrl=text('projectUrl',2000),revision=text('revision',200),focusPath=text('focusPath',300);
 if(projectUrl&&!safeUrl(projectUrl))fail(400,'Invalid project URL');
 if(focusPath&&!safePath(focusPath))fail(400,'Invalid project path');
 if(!Array.isArray(input.files)||input.files.length>limits.files)fail(400,'Too many files');
 const files=input.files.map((f,index)=>{if(!f||!safePath(f.path)||!Number.isSafeInteger(f.size)||f.size<1||f.size>limits.fileBytes)fail(400,'Unsupported file path or size');return {id:index,path:f.path.replaceAll('\\','/'),size:f.size,type:typeof f.type==='string'?f.type.slice(0,100):'application/octet-stream'};});
 if(new Set(files.map(f=>f.path.toLowerCase())).size!==files.length)fail(400,'Duplicate file paths');
 const totalBytes=files.reduce((n,f)=>n+f.size,0);if(totalBytes>limits.totalBytes)fail(413,'Project upload exceeds 1 GiB; use repository or release links');
 const community=publicProposal(input.community,input.publicConsent,{kind,intent,relatedId,provenance});
 if(!community&&!note&&!code&&!projectUrl&&!files.length)fail(400,'Add at least one material');
 if(input.consent!==true)fail(400,'Confirm review and publication terms');
 return {payload:{title,note,code,context,kind,intent,relatedId,provenance,project:{url:projectUrl,revision,path:focusPath}},files,totalBytes,...(community?{community}:{})};
}
export async function readBytes(request,max){
 const length=Number(request.headers.get('content-length'));if(Number.isFinite(length)&&length>max)fail(413,'Request too large');
 if(!request.body)return new Uint8Array();const reader=request.body.getReader(),chunks=[];let size=0;
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reader.cancel().catch(()=>{});reject(new HttpError(408,'Upload timed out; retry this part'));},60000);});
 try{while(true){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'Request too large');}chunks.push(value);}}finally{clearTimeout(timer);reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
export async function readJson(request,max=limits.bodyBytes){if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use application/json');try{return JSON.parse(new TextDecoder().decode(await readBytes(request,max)));}catch(e){if(e instanceof HttpError)throw e;fail(400,'Invalid JSON');}}
export const hex=buffer=>Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async text=>hex(await crypto.subtle.digest('SHA-256',typeof text==='string'?new TextEncoder().encode(text):text));
export async function hmac(secret,text){if(!secret||secret.length<32)fail(503,'Intake is not configured');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));}
export const partKey=(id,file,part)=>`quarantine/${id}/${file}/${part}`;
export const now=()=>Math.floor(Date.now()/1000);

// This is a separate, explicit publication envelope. Never infer it from raw notes/files.
export function publicProposal(value,consent,metadata){
 if(value===undefined||value===null)return null;
 if(consent!==true)fail(400,'请确认公开提案内容 / Confirm public proposal consent');
 const text=(key,max,required=false)=>{const v=value[key]??'';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,`Invalid public ${key}`);return v.trim();};
 const title=text('title',200,true),summary=text('summary',1000,true),context=text('context',4000),limitations=text('limitations',4000);
 if(!Array.isArray(value.sources)||!value.sources.length||value.sources.length>10||value.sources.some(u=>typeof u!=='string'||u.length>2000||!safeUrl(u)))fail(400,'公开提案需要来源链接 / Add a public source URL');
 const evidenceType=value.evidenceType||'community-report';
 if(!['community-report','vendor-advisory','research-poc','paper','project','model-card'].includes(evidenceType))fail(400,'Invalid evidence class');
 return {title,summary,context,limitations,sources:[...new Set(value.sources)],evidenceType,...metadata,disclosure:'community',verification:'unverified'};
}

