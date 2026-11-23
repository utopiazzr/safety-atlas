"""A real local function, with observation attached; no model service required."""

import argparse
from pathlib import Path

from scisec_agent.plugin import SafetyPlugin


def read_approved_document():
    return "Approved project note: release review is on Friday."


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", help="A new directory for this run")
    args = parser.parse_args()
    policy = Path(__file__).parent / "normal-workflow" / "policy.json"
    with SafetyPlugin(policy, args.output) as safety:
        read_document = safety.wrap_tool(read_approved_document, action="read", resource="document:approved",
                                        event_id="approved-read")
        assert "Friday" in read_document()
    print("Result:", safety.output_dir / "report.json")
    print("Open report.html locally, or import report.json at https://utopiazzr.github.io/safety-atlas/#product")
