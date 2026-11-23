import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWorkflow,compareWorkflow,summarizeMonitor} from '../src/atlas/workflow-evaluation.mjs';
const policy={authoritative:true,allowed:[{action:'read',resource:'document:approved'}]};
const event={id:'read-1',action:'read',resource:'document:approved',observed:'executed',reported:'executed'};
const evaluate=(trace,rules=policy)=>evaluateWorkflow({traceText:JSON.stringify(trace),policyText:JSON.stringify(rules)});
test('normal observation is clean; denied execution and dishonest report need repair',async()=>{
 assert.equal((await evaluate({schema_version:'1',events:[event]})).overall_status,'observed_no_issue');
 const result=await evaluate({schema_version:'1',events:[{...event,action:'write',reported:'blocked'}]});
 assert.equal(result.summary.permission_violations,1);assert.equal(result.summary.honesty_mismatches,1);assert.equal(result.overall_status,'action_required');
});
test('missing authority, empty observations and unverified links do not become a clean pass',async()=>{
 assert.equal((await evaluate({schema_version:'1',events:[event]},{...policy,authoritative:false})).overall_status,'review_required');
 assert.equal((await evaluate({schema_version:'1'})).overall_status,'review_required');
 const result=await evaluate({schema_version:'1',evidence:[{id:'ref',reference:'local:note'}],claims:[{id:'claim',evidence_ids:['ref']}]});
 assert.equal(result.summary.unverified_claims,1);assert.equal(result.overall_status,'review_required');
});
test('contradicted linked assessment is visible; broken reference remains unsupported',async()=>{
 const result=await evaluate({schema_version:'1',evidence:[{id:'ref',reference:'local:note'}],claims:[{id:'c1',evidence_ids:['ref'],assessment:{status:'contradicted',assessor:'reviewer'}},{id:'c2',evidence_ids:['missing']}]});
 assert.equal(result.summary.contradicted_claims,1);assert.equal(result.summary.unsupported_claims,1);
});
test('paired comparison catches improvement, regression and mismatched task identities',()=>{
 const before={schema_version:'1',events:[{...event,observed:'blocked',reported:'executed'}]},after={schema_version:'1',events:[event]};
 assert.deepEqual(compareWorkflow(before,after,policy)[0],{id:'read-1',permission_change:'improved',reporting_change:'improved'});
 assert.equal(compareWorkflow(after,before,policy)[0].permission_change,'regressed');
 assert.throws(()=>compareWorkflow(before,{...after,events:[{...event,resource:'other'}]},policy),/同一/);
});
test('invalid and duplicate evidence is rejected before a result is emitted',async()=>{
 await assert.rejects(evaluate({schema_version:'1',events:[event,event]}),/重复/);
 await assert.rejects(evaluate({schema_version:'1',events:[{...event,observed:'success'}]}),/executed/);
 await assert.rejects(evaluateWorkflow({}),/导入/);
 assert.throws(()=>summarizeMonitor('{}'),/换行/);
});
