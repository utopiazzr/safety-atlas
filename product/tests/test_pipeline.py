import json
import tempfile
import unittest
import shutil
import subprocess
from pathlib import Path

from scisec_agent.pipeline import run_pipeline


class PipelineTests(unittest.TestCase):
    def test_browser_and_cli_agree_on_normal_issue_unknown_and_claim_evidence(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node is needed for cross-runtime contract verification")
        module = (Path(__file__).resolve().parents[2] / "src/atlas/workflow-evaluation.mjs").as_uri()
        fixtures = [
            {"schema_version": "1", "events": [{"id": "read", "action": "read", "resource": "approved", "observed": "executed", "reported": "executed"}]},
            {"schema_version": "1", "events": [{"id": "read", "action": "write", "resource": "approved", "observed": "executed", "reported": "blocked"}]},
            {"schema_version": "1", "events": [{"id": "read", "action": "read", "resource": "approved", "observed": "unknown"}]},
            {"schema_version": "1", "evidence": [{"id": "ref", "reference": "local:ref"}], "claims": [
                {"id": "unverified", "evidence_ids": ["ref"]}, {"id": "missing"},
                {"id": "contradiction", "evidence_ids": ["ref"], "assessment": {"status": "contradicted", "assessor": "reviewer"}}]},
            {"schema_version": "1"},
        ]
        for trace in fixtures:
            with self.subTest(trace=trace), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                trace_text = json.dumps(trace)
                policy_text = json.dumps({"authoritative": True, "allowed": [{"action": "read", "resource": "approved"}]})
                (root / "behavior.json").write_text(trace_text)
                (root / "policy.json").write_text(policy_text)
                (root / "manifest.json").write_text(json.dumps({"schema_version": "1", "behavior": {"trace": "behavior.json", "policy": "policy.json"}}))
                run_pipeline(root / "manifest.json", root / "report.json")
                python_report = json.loads((root / "report.json").read_text())
                js = "const {evaluateWorkflow}=await import(" + json.dumps(module) + "); console.log(JSON.stringify(await evaluateWorkflow(" + json.dumps({"traceText": trace_text, "policyText": policy_text}) + ")));"
                browser_report = json.loads(subprocess.check_output([node, "--input-type=module", "-e", js], text=True, timeout=15))
                for key in ("summary", "overall_status", "remediation"):
                    self.assertEqual(python_report[key], browser_report[key])

    def test_scored_context_shortfall_and_pending_record_require_review(self):
        from scisec_agent.faithfulness_ledger import create_ledger, mark_in_flight, mark_completed
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            raw = b"normal-answer-sample"
            db = create_ledger(root / "ledger.db", manifest_sha256="1" * 64,
                               snapshots=[("scored", raw, None), ("pending", b"other", None)],
                               model="local-test", provider_sha256="2" * 64, metric_version="test")
            mark_in_flight(db, "scored")
            mark_completed(db, "scored", {"sample_sha256": hashlib.sha256(raw).hexdigest(),
                "question_sha256": "3" * 64, "contexts_sha256": "4" * 64,
                "provider_sha256": "2" * 64, "adapter_version": "1", "metric": "ragas_faithfulness",
                "metric_version": "test", "judge_model": "local-test", "score": 0.5, "status": "scored",
                "scope": "context_support_model_judgment_not_truth_or_permission"})
            db.close()
            (root / "manifest.json").write_text(json.dumps({"schema_version": "1", "faithfulness_ledger": "ledger.db"}))
            run_pipeline(root / "manifest.json", root / "report.json")
            report = json.loads((root / "report.json").read_text())
            self.assertEqual(report["summary"]["context_support_below_one"], 1)
            self.assertEqual(report["summary"]["unknown_outcomes"], 1)
            self.assertEqual(report["overall_status"], "review_required")
    def test_normal_workflow_generates_json_and_private_html(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "policy.json").write_text(json.dumps({"authoritative": True, "allowed": [{"action": "read", "resource": "document:approved"}]}))
            (root / "behavior.json").write_text(json.dumps({"schema_version": "1", "events": [{"id": "read", "action": "read", "resource": "document:approved", "observed": "executed", "reported": "executed"}]}))
            (root / "manifest.json").write_text(json.dumps({"schema_version": "1", "behavior": {"trace": "behavior.json", "policy": "policy.json"}}))
            summary = run_pipeline(root / "manifest.json", root / "report.json", root / "report.html")
            self.assertEqual(summary["overall_status"], "observed_no_issue")
            report = json.loads((root / "report.json").read_text())
            self.assertEqual(report["coverage"], ["behavior"])
            self.assertNotIn("document:approved", (root / "report.html").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
