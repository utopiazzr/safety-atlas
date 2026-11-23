"""Opt-in OpenTelemetry SDK processor for normal agent tool observations.

The caller owns the tracer provider and sink. Tool inputs and outputs are never
read by this processor. This does not enforce policy or observe resource access.
"""

import hashlib
import threading
from pathlib import Path
from typing import Callable

from opentelemetry.sdk.trace import SpanProcessor

from .telemetry import ToolPolicy


class ToolMonitor(SpanProcessor):
    def __init__(self, sink: Callable[[dict], None], policy: ToolPolicy | None = None,
                 policy_sha256: str | None = None):
        self._sink = sink
        self._policy = policy
        self._policy_sha256 = policy_sha256
        self._lock = threading.Lock()
        self._emitted = 0
        self._sink_errors = 0

    def on_start(self, span, parent_context=None):
        pass

    def on_end(self, span):
        attributes = span.attributes or {}
        if attributes.get("gen_ai.operation.name") != "execute_tool":
            return
        tool = attributes.get("gen_ai.tool.name")
        tool = tool if isinstance(tool, str) and tool else None
        result = "unknown"
        if self._policy and self._policy.authoritative and tool:
            result = "listed" if tool in self._policy.allowed_tools else "unlisted"
        context = span.get_span_context()
        status = span.status.status_code.name.lower()
        event = {"trace_id": f"{context.trace_id:032x}", "span_id": f"{context.span_id:016x}",
                 "tool_name": tool, "span_status": status, "tool_policy_result": result,
                 "permission_result": "unknown", "tool_policy_sha256": self._policy_sha256,
                 "start_time_unix_nano": span.start_time, "end_time_unix_nano": span.end_time}
        try:
            self._sink(event)
        except Exception:
            with self._lock:
                self._sink_errors += 1
        else:
            with self._lock:
                self._emitted += 1

    def stats(self) -> dict:
        with self._lock:
            return {"emitted": self._emitted, "sink_errors": self._sink_errors}

    def shutdown(self):
        pass

    def force_flush(self, timeout_millis=30000):
        return True


def attach_tool_monitor(provider, sink: Callable[[dict], None], policy_path: str | Path | None = None) -> ToolMonitor:
    """Attach to an existing SDK provider; the sink executes synchronously."""
    if not callable(sink):
        raise ValueError("sink_must_be_callable")
    policy = None
    policy_hash = None
    if policy_path is not None:
        raw = Path(policy_path).expanduser().read_bytes()
        policy = ToolPolicy.model_validate_json(raw)
        policy_hash = hashlib.sha256(raw).hexdigest()
    monitor = ToolMonitor(sink, policy, policy_hash)
    provider.add_span_processor(monitor)
    return monitor
