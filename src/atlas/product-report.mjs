const labels={permission_violations:'权限越界',honesty_mismatches:'行为与报告不一致',unsupported_claims:'缺少证据的主张',tool_errors:'工具错误',unlisted_tools:'未列入策略的工具',judge_errors:'评测器错误',unknown_outcomes:'结果未知'};
const statuses={action_required:'需要修复',review_required:'需要复核',observed_no_issue:'本次证据未见问题'};
const extraLabels={permission_unknowns:'权限结论未知',contradicted_claims:'依据评审发现矛盾',unverified_claims:'已关联但未核实',monitoring_gaps:'监控证据缺项',context_support_below_one:'语义依据评分待复核'};
const actions={resolve_permission_unknowns:'补齐权威权限策略和实际执行结果，再做权限判断。',correct_contradicted_claims:'核对评审依据，纠正或撤回存在矛盾的回答。',review_unverified_claims:'核对引用是否真正支持主张；关联依据不等于已经核实。',enforce_permission_boundary:'收紧越权动作，在同一权限策略下复测正常任务。',reduce_false_blocks:'仅放行正常任务所需动作，复测是否仍有误拦截。',repair_action_reporting:'让完成报告绑定实际工具结果，复测同一任务。',support_or_qualify_claims:'为主张补齐可核对的依据，或明确标注不确定。',complete_monitoring_evidence:'补齐工具策略和最终状态后，再解释监控结果。',investigate_tool_errors:'根据脱敏 trace ID 检查工具错误，复测正常调用。',review_unlisted_tools:'为未列入策略的工具补充明确权限，或将其移出工作流。',resolve_unknown_evaluation_outcomes:'核对尚无结论的评测记录，避免自动重复提交。',repair_judge_connectivity:'修复评测服务连接后，以新运行记录补测待处理样本。'};

export function normalizeProductReport(value){
 if(!value||value.schema_version!=='1'||value.product!=='scisec-agent-product')throw new Error('不支持的产品结果格式。');
 if(!Object.hasOwn(statuses,value.overall_status)||!value.summary||typeof value.summary!=='object'||!Array.isArray(value.coverage)||!Array.isArray(value.remediation))throw new Error('产品结果不完整。');
 const metrics=Object.entries(labels).map(([key,label])=>{const count=value.summary[key];if(!Number.isInteger(count)||count<0)throw new Error('产品结果计数无效。');return {key,label,count}});
 for(const [key,label] of Object.entries(extraLabels))if(Object.hasOwn(value.summary,key)){const count=value.summary[key];if(!Number.isInteger(count)||count<0)throw new Error('产品结果计数无效。');metrics.push({key,label,count})}
 const remediation=value.remediation.map(item=>{
  if(!item||typeof item.code!=='string'||typeof item.action!=='string'||!['high','medium','low'].includes(item.severity)||!Number.isInteger(item.evidence_count)||item.evidence_count<0)throw new Error('修复队列格式无效。');
  return {code:item.code,action:actions[item.code]||item.action,severity:item.severity,count:item.evidence_count};
 });
 const metricCoverage={permission_violations:'behavior',honesty_mismatches:'behavior',unsupported_claims:'behavior',permission_unknowns:'behavior',contradicted_claims:'behavior',unverified_claims:'behavior',tool_errors:'monitor',unlisted_tools:'monitor',monitoring_gaps:'monitor',judge_errors:'faithfulness',context_support_below_one:'faithfulness'};
 return {status:value.overall_status,statusLabel:statuses[value.overall_status],coverage:value.coverage.map(String),metrics:metrics.filter(metric=>!metricCoverage[metric.key]||value.coverage.includes(metricCoverage[metric.key])),remediation,scope:String(value.scope||'')};
}

const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element};
export function renderProductReport(host,value,source){
 const report=normalizeProductReport(value),head=node('div','product-report-head');
 head.append(node('p','eyebrow',source),node('h2','',report.statusLabel));
 const coverageNames={behavior:'权限 / 行为 / 依据记录',monitor:'工具监控',guard:'策略决策',faithfulness:'语义依据评分',workspace:'工作目录'};
 const coverage=node('p','product-coverage','本次覆盖：'+(report.coverage.map(key=>coverageNames[key]||key).join(' · ')||'无'));
 const grid=node('div','product-metrics');for(const metric of report.metrics){const card=node('article');card.append(node('span','',String(metric.count)),node('strong','',metric.label));grid.append(card)}
 const queue=node('div','product-remediation');queue.append(node('h3','',report.remediation.length?'修复队列':'持续监控'));
 if(report.remediation.length){const list=node('ol');for(const item of report.remediation){const entry=node('li');entry.append(node('p','',item.action),node('small','',`${{high:'高优先级',medium:'待复核',low:'建议'}[item.severity]} · ${item.count} 条证据`));list.append(entry)}queue.append(list)}else queue.append(node('p','', '保持相同范围和策略，继续记录正常业务证据。'));
 host.replaceChildren(head,coverage,grid,queue,node('p','product-scope','基于调用方提供的非攻击性证据；不构成安全保证。'));
}

export async function mountProductReport(host,input,demoUrl){
 let version=0;
 input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;version++;if(file.size>2*1024*1024){host.replaceChildren(node('p','product-error','结果文件超过 2 MiB。'));return}try{renderProductReport(host,JSON.parse(await file.text()),'本地结果 · 未上传')}catch(error){host.replaceChildren(node('p','product-error',error instanceof Error?error.message:'无法读取结果。'))}});
 try{const response=await fetch(demoUrl,{cache:'no-store'});if(!response.ok)throw new Error('示例暂时不可用。');const report=await response.json();if(!version)renderProductReport(host,report,'公开合成示例')}catch(error){if(!version)host.replaceChildren(node('p','product-error',error instanceof Error?error.message:'示例暂时不可用。'))}
}
