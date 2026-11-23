"""Optional local audit records for tool-policy middleware decisions."""

import hashlib
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .monitor_events import JsonlEventSink


class GuardEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    schema_version: Literal["1"]
    decision: Literal["passed_policy", "blocked"]
    tool_name: str | None
    call_id_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    tool_policy_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    timestamp_unix_nano: int = Field(ge=0)


class GuardEventSink(JsonlEventSink):
    """Store decisions only, never tool inputs or outputs."""

    event_model = GuardEvent


class DecisionRecorder:
    """Record decisions without retaining tool input or resource identifiers."""

    def __init__(self, policy_hash: str, sink=None):
        if sink is not None and not callable(sink):
            raise ValueError("audit_sink_must_be_callable")
        self._policy_hash = policy_hash
        self._sink = sink
        self._lock = threading.Lock()
        self._allowed = 0
        self._blocked = 0
        self._errors = 0

    def record(self, call_id: str, name, allowed: bool):
        with self._lock:
            if allowed:
                self._allowed += 1
            else:
                self._blocked += 1
        if self._sink is None:
            return
        try:
            event = {"schema_version": "1", "decision": "passed_policy" if allowed else "blocked",
                     "tool_name": name if isinstance(name, str) and name else None,
                     "call_id_sha256": hashlib.sha256(call_id.encode("utf-8")).hexdigest(),
                     "tool_policy_sha256": self._policy_hash, "timestamp_unix_nano": time.time_ns()}
            self._sink(event)
        except Exception:
            with self._lock:
                self._errors += 1

    def stats(self):
        with self._lock:
            return {"allowed": self._allowed, "blocked": self._blocked,
                    "tool_policy_sha256": self._policy_hash, "audit_enabled": self._sink is not None,
                    "audit_errors": self._errors}


def summarize_guard_events(path: str | Path) -> dict:
    raw = Path(path).expanduser().read_bytes()
    if raw and not raw.endswith(b"\n"):
        raise ValueError("incomplete_guard_event_file")
    counts = Counter()
    policies = set()
    for line in raw.splitlines():
        if not line.strip():
            raise ValueError("empty_guard_event_line")
        event = GuardEvent.model_validate_json(line)
        counts[event.decision] += 1
        policies.add(event.tool_policy_sha256)
    return {"source_sha256": hashlib.sha256(raw).hexdigest(),
            "decision_count": sum(counts.values()),
            "decisions": {key: counts[key] for key in ("passed_policy", "blocked")},
            "policy_sha256": sorted(policies),
            "scope": "recorded_guard_decisions_not_execution_or_completeness"}
