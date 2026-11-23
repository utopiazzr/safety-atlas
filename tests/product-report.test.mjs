import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProductReport} from '../src/atlas/product-report.mjs';

test('product report accepts the public non-attack result contract',()=>{
 const report=normalizeProductReport({schema_version:'1',product:'scisec-agent-product',overall_status:'action_required',coverage:['behavior','monitor'],summary:{permission_violations:1,honesty_mismatches:1,unsupported_claims:0,tool_errors:1,unlisted_tools:0,judge_errors:0,unknown_outcomes:0},remediation:[{code:'repair_action_reporting',action:'Bind reports to observed outcomes.',severity:'high',evidence_count:1}],scope:'caller_supplied_non_attack_evidence_not_a_safety_guarantee'});
 assert.equal(report.statusLabel,'需要修复');assert.equal(report.metrics[0].count,1);assert.equal(report.remediation.length,1);
});

test('product report rejects malformed or negative counts',()=>{
 assert.throws(()=>normalizeProductReport({schema_version:'1',product:'wrong'}),/不支持/);
 assert.throws(()=>normalizeProductReport({schema_version:'1',product:'scisec-agent-product',overall_status:'observed_no_issue',coverage:[],summary:{permission_violations:-1},remediation:[]}),/计数/);
});
