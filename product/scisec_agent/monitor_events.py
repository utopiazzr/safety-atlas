"""Local opt-in storage and read-only summary of sanitized tool observations."""

import hashlib
import threading
from collections import Counter
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MonitorEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    trace_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    span_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    tool_name: str | None
    span_status: Literal["unset", "ok", "error"]
    tool_policy_result: Literal["listed", "unlisted", "unknown"]
    permission_result: Literal["unknown"]
    tool_policy_sha256: str | None = Field(pattern=r"^[0-9a-f]{64}$")
    start_time_unix_nano: int | None = Field(ge=0)
    end_time_unix_nano: int | None = Field(ge=0)


class JsonlEventSink:
    """Write sanitized events to a new local file; caller owns its lifecycle."""

    event_model = MonitorEvent

    def __init__(self, path: str | Path):
        self._stream = Path(path).expanduser().open("x", encoding="utf-8", newline="\n")
        self._lock = threading.Lock()

    def __call__(self, event: dict) -> None:
        checked = self.event_model.model_validate(event)
        line = checked.model_dump_json() + "\n"
        with self._lock:
            self._stream.write(line)
            self._stream.flush()

    def close(self) -> None:
        with self._lock:
            self._stream.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def summarize_monitor_events(path: str | Path) -> dict:
    """Summarize a closed event file. Never infer authorization from spans."""
    raw = Path(path).expanduser().read_bytes()
    if raw and not raw.endswith(b"\n"):
        raise ValueError("incomplete_monitor_event_file")
    counts = Counter()
    statuses = Counter()
    policies = set()
    seen = set()
    for line in raw.splitlines():
        if not line.strip():
            raise ValueError("empty_monitor_event_line")
        event = MonitorEvent.model_validate_json(line)
        identity = (event.trace_id, event.span_id)
        if identity in seen:
            raise ValueError("duplicate_monitor_event")
        seen.add(identity)
        counts[event.tool_policy_result] += 1
        statuses[event.span_status] += 1
        if event.tool_policy_sha256 is not None:
            policies.add(event.tool_policy_sha256)
    return {"source_sha256": hashlib.sha256(raw).hexdigest(), "event_count": len(seen),
            "tool_policy_counts": {key: counts[key] for key in ("listed", "unlisted", "unknown")},
            "span_status_counts": {key: statuses[key] for key in ("ok", "error", "unset")},
            "policy_sha256": sorted(policies), "permission_result": "unknown",
            "scope": "recorded_instrumented_spans_only"}
