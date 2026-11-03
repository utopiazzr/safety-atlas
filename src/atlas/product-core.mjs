import {canonicalUrl, extractLinks, resourceType, webUrl} from './url-tools.mjs';
export {webUrl};
export const contexts = {all:'所有场景',content:'读网页 / 文档',tools:'用工具 / MCP',memory:'使用长期记忆',evaluation:'测试模型'};
export const categories = {all:'全部',report:'案例',attack:'攻击研究',defense:'防御与工具'};
const normalize = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'');
export function searchRecords(records,{query='',context='all',kind='all'}={}) {
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return records.filter(e=> (kind==='all'||e.category===kind) && (context==='all'||e.contexts.includes(context)))
 .map(e=>{const title=normalize(e.title), hay=normalize([e.id,e.title,e.summary,e.theme,e.aliases,e.relevance,...Object.values(e.environment),...e.sources.map(s=>s.url)].join(' '));return {e,score:terms.reduce((n,t)=>n+(title.includes(t)?5:hay.includes(t)?1:0),0),match:terms.every(t=>hay.includes(t))}})
 .filter(x=>x.match).sort((a,b)=>b.score-a.score).map(x=>x.e);
}
export function inspectMaterial(records,text,project='') {
 const links=extractLinks(text);if(webUrl(project))links.push(project);
 const unique=[...new Map(links.map(url=>[canonicalUrl(url),url])).values()];
 return {links:unique.map(url=>({url,type:resourceType(url)})),matches:records.filter(e=>[...e.sources,...e.resources].some(s=>unique.some(u=>canonicalUrl(u)===canonicalUrl(s.url)))).map(e=>e.id)};
}
export function makeDraft(records,fields,files=[]) {
 const material=String(fields.material??'').trim(),project=String(fields.project??'').trim();
 if(!material&&!project&&!files.length)throw new Error('先留下一个链接、一段文字或一个文件。');
 if(project&&!webUrl(project))throw new Error('项目地址请使用不含账号密码的完整 http(s) 链接。');
 const intent=['new','evidence','correction'].includes(fields.intent)?fields.intent:'new';
 const relatedId=records.some(e=>e.id===fields.relatedId)?fields.relatedId:null;
 if(intent!=='new'&&!relatedId)throw new Error('补证或更正需要关联一个已有案例。');
 return {schemaVersion:'atlas-draft/1',status:'local-draft',submitted:false,createdAt:new Date().toISOString(),intent,relatedId,
  kind:fields.kind||'线索 / 怀疑',visibility:fields.private?'private':'undecided',material,
  resources:inspectMaterial(records,material,project).links,
  environment:{product:String(fields.product??'').trim(),version:String(fields.version??'').trim(),project,path:String(fields.path??'').trim()},
  observation:{expected:String(fields.expected??'').trim(),actual:String(fields.actual??'').trim()},
  attachments:files.map(f=>({name:f.name,size:f.size,type:f.type||'unknown',uploaded:false})),
  notice:'本文件是未提交草稿；附件仅记录文件清单，不含文件内容。分类、关联与建议需要复核。'};
}
export function checklistText(entry,checked=new Set()) {
 return [`Safety Atlas · ${entry.title}`,entry.summary,`资料整理日期：${entry.checkedAt}；未独立复现 / 未验证防护效果。`,
  `产品 / 环境：${entry.environment.product}`,`版本：${entry.environment.versions||'原资料未固定；使用前核对'}`,`前提：${entry.environment.requirements}`,
  '', '检查建议（勾选仅代表你的自查记录）',...entry.checks.map(([title,body],i)=>`${checked.has(i)?'[x]':'[ ]'} ${title}\n    ${body}`),
  '', '范围与限制',...entry.limitations.map(x=>'• '+x),'','原始来源',...entry.sources.map(s=>`${s.label}: ${s.url}`),`检查参考: ${entry.checkSource}`].join('\n');
}
