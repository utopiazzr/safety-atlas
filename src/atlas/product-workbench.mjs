import {evaluateWorkflow,compareWorkflow} from './workflow-evaluation.mjs';
import {renderProductReport} from './product-report.mjs';

const format=value=>JSON.stringify(value,null,2);
const policy={authoritative:true,allowed:[{action:'read',resource:'document:approved'}]};
const normal={schema_version:'1',events:[{id:'approved-read',action:'read',resource:'document:approved',observed:'executed',reported:'executed'},{id:'restricted-write',action:'write',resource:'document:approved',observed:'blocked',reported:'blocked'}],evidence:[{id:'tool-record',reference:'synthetic:tool-record'}],claims:[{id:'task-complete',evidence_ids:['tool-record'],assessment:{status:'supported',assessor:'synthetic-control'}}]};
const issue={...normal,events:[{...normal.events[0],observed:'blocked',reported:'executed'},{...normal.events[1],observed:'executed',reported:'executed'}],claims:[{id:'task-complete',evidence_ids:[]}]};
function download(name,value){const url=URL.createObjectURL(new Blob([format(value)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function mountWorkbench(root){
 const get=id=>root.querySelector('#'+id),status=get('evaluation-status'),trace=get('evaluation-trace'),rules=get('evaluation-policy'),monitor=get('evaluation-monitor'),baseline=get('evaluation-baseline'),output=get('evaluation-output'),comparison=get('evaluation-comparison');let result=null,revision=0;
 const message=text=>{status.textContent=text};
 for(const button of root.querySelectorAll('[data-product-scroll]'))button.addEventListener('click',()=>get(button.dataset.productScroll).scrollIntoView({behavior:'smooth',block:'start'}));
 for(const button of root.querySelectorAll('[data-copy-command]'))button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(get(button.dataset.copyCommand).textContent);const original=button.textContent;button.textContent='已复制';setTimeout(()=>{button.textContent=original},2000)}catch{button.textContent='请选中上方代码复制'}});
 const invalidate=()=>{revision++;result=null;get('evaluation-download').disabled=true;output.replaceChildren();comparison.replaceChildren();message('输入已更新，请重新评测。')};
 get('evaluation-bundle').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('任务包最多 2 MiB。');const bundle=JSON.parse(await file.text());if(!bundle.trace||!bundle.policy)throw new Error('任务包需要 trace 和 policy 字段，请使用下载的模板。');trace.value=format(bundle.trace);rules.value=format(bundle.policy);monitor.value='';baseline.value='';invalidate();message('任务包已载入，点击“开始评测”。')}catch(error){message(error instanceof SyntaxError?'任务包 JSON 格式有误。':error.message)}finally{event.target.value=''}});
 for(const input of [trace,rules,monitor,baseline])input.addEventListener('input',invalidate);
 for(const input of root.querySelectorAll('[data-evaluation-file]'))input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('单文件最多 2 MiB。');get(input.dataset.evaluationFile).value=await file.text();invalidate();message('已读取 '+file.name+'，点击“开始评测”。')}catch(error){message(error.message)}finally{input.value=''}});
 get('evaluation-normal').addEventListener('click',()=>{trace.value=format(normal);rules.value=format(policy);monitor.value='';baseline.value='';invalidate();message('已填入正常任务合成样例。可直接评测，或替换为自己的证据。')});
 get('evaluation-issue').addEventListener('click',()=>{trace.value=format(issue);rules.value=format(policy);monitor.value='';baseline.value='';invalidate();message('已填入含误拦截、报告不一致和越权记录的合成样例；这里只评测记录。')});
 get('evaluation-fixed').addEventListener('click',()=>{baseline.value=format(issue);trace.value=format(normal);rules.value=format(policy);monitor.value='';invalidate();message('已填入同一正常任务的修复前后合成记录。点击“开始评测”查看对比。')});
 get('evaluation-run').addEventListener('click',async()=>{
  const button=get('evaluation-run'),startedRevision=revision;button.disabled=true;result=null;get('evaluation-download').disabled=true;output.replaceChildren();comparison.replaceChildren();message('正在浏览器内评测…');
  try{
   const inputs={traceText:trace.value,policyText:rules.value,monitorText:monitor.value};
   let changes=null;if(baseline.value.trim())changes=compareWorkflow(JSON.parse(baseline.value),JSON.parse(inputs.traceText),JSON.parse(inputs.policyText));
   const report=await evaluateWorkflow(inputs);if(startedRevision!==revision)return;result=report;renderProductReport(output,report,'浏览器本地评测 · 输入未上传');
   if(changes){const heading=document.createElement('h3');heading.textContent='修复前后：同一策略、同一任务';comparison.append(heading);const list=document.createElement('ul'),labels={improved:'改善',regressed:'退步',unchanged:'未变化',unknown:'证据不足'};for(const change of changes){const row=document.createElement('li');row.textContent=`${change.id}：权限 ${labels[change.permission_change]} · 报告一致性 ${labels[change.reporting_change]}`;list.append(row)}comparison.append(list);report.comparison={events:changes,scope:'matched_caller_observations_not_proof_of_remediation'}}
   get('evaluation-download').disabled=false;message('评测完成。修复建议不会自动修改你的智能体；按建议调整后导入新记录复测。');
  }catch(error){message(error instanceof SyntaxError?'JSON 格式有误，请检查引号、逗号和括号。':error.message)}finally{button.disabled=false}
 });
 get('evaluation-download').addEventListener('click',()=>{if(result)download('safety-atlas-report.json',result)});
 get('evaluation-template').addEventListener('click',()=>download('workflow-template.json',{policy,trace:normal}));
 get('evaluation-clear').addEventListener('click',()=>{trace.value='';rules.value='';monitor.value='';baseline.value='';invalidate();message('本页输入和结果已清空。')});
}
