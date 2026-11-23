import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from scisec_agent import SafetyPlugin
from scisec_agent.quickstart import quickstart

class PluginTests(unittest.TestCase):
    def test_observe_preserves_result_and_exception_without_recording_payload(self):
        with tempfile.TemporaryDirectory() as temp:
            safety = SafetyPlugin(output_dir=Path(temp) / "run")
            tool = safety.wrap_tool(lambda value: "private-output-" + value, event_id="normal")
            self.assertEqual(tool("private-input"), "private-output-private-input")
            def failing():
                raise RuntimeError("private-error")
            with self.assertRaisesRegex(RuntimeError, "private-error"):
                safety.wrap_tool(failing)()
            safety.close()
            report = json.loads((safety.output_dir / "report.json").read_text())
            self.assertEqual(report["summary"]["tool_errors"], 1)
            self.assertEqual(report["summary"]["permission_unknowns"], 2)
            for file in safety.output_dir.iterdir():
                self.assertNotIn("private-", file.read_text(encoding="utf-8"))
            with self.assertRaisesRegex(RuntimeError, "plugin_closed"):
                tool("later")

    def test_enforce_denies_before_execution_and_preserves_allowed_normal_call(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            policy = root / "policy.json"
            policy.write_text(json.dumps({"authoritative": True, "allowed": [{"action": "read", "resource": "approved"}]}))
            effects = []
            with SafetyPlugin(policy, root / "run", mode="enforce") as safety:
                allowed = safety.wrap_tool(lambda: effects.append("read"), action="read", resource="approved", event_id="normal")
                denied = safety.wrap_tool(lambda: effects.append("write"), action="write", resource="approved", event_id="denied")
                allowed()
                with self.assertRaises(PermissionError):
                    denied()
                self.assertEqual(effects, ["read"])
                safety.record_report("normal", "executed")
                with self.assertRaisesRegex(ValueError, "duplicate_event_id"):
                    allowed()
            report = json.loads((safety.output_dir / "report.json").read_text())
            self.assertEqual(report["overall_status"], "observed_no_issue")
            self.assertEqual(report["evidence"]["behavior"]["events"][1]["permission_result"], "unauthorized_attempt_blocked")

    def test_async_tools_and_first_run_work_without_optional_dependencies(self):
        with tempfile.TemporaryDirectory() as temp:
            async def normal():
                return 42
            with SafetyPlugin(output_dir=Path(temp) / "async") as safety:
                self.assertEqual(asyncio.run(safety.wrap_tool(normal)()), 42)
            result = quickstart(Path(temp) / "first")
            self.assertTrue(Path(result["html_path"]).is_file())
            self.assertEqual(json.loads(Path(result["report_path"]).read_text())["overall_status"], "observed_no_issue")

    def test_empty_plugin_is_insufficient_and_enforcement_requires_authority(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "authoritative"):
                SafetyPlugin(output_dir=Path(temp) / "denied", mode="enforce")
            with SafetyPlugin(output_dir=Path(temp) / "empty") as safety:
                pass
            report = json.loads((safety.output_dir / "report.json").read_text())
            self.assertEqual(report["overall_status"], "review_required")

if __name__ == "__main__":
    unittest.main()
