"""An installed-package first run; no repository checkout or API key required."""

import json
import time
import uuid
import webbrowser
from pathlib import Path

from .plugin import SafetyPlugin


def quickstart(output=None, *, open_report=False):
    root = Path(output or Path("safety-runs") / ("first-run-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])).resolve()
    root.mkdir(parents=True, exist_ok=False)
    document = root / "approved-note.txt"
    document.write_text("Release review is on Friday.\n", encoding="utf-8")
    policy = root / "policy.json"
    policy.write_text(json.dumps({"authoritative": True, "allowed": [{"action": "read", "resource": "document:approved"}]}), encoding="utf-8")
    with SafetyPlugin(policy, root / "evaluation") as safety:
        checked_read = safety.wrap_tool(lambda: document.read_text(encoding="utf-8"), action="read",
                                        resource="document:approved", name="read_document", event_id="approved-read")
        checked_read()
    report = safety.output_dir / "report.html"
    if open_report:
        webbrowser.open(report.as_uri())
    return {"status": "completed", "kind": "local_normal_function_first_run",
            "report_path": str(safety.output_dir / "report.json"), "html_path": str(report),
            "website": "https://utopiazzr.github.io/safety-atlas/#product",
            "next_step": "Attach SafetyPlugin.wrap_tool to your own tool; see the website installation guide."}
