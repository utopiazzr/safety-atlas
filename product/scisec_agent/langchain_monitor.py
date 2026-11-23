"""Opt-in LangChain tool callbacks emitting OpenTelemetry tool spans."""

import threading

from langchain_core.callbacks import BaseCallbackHandler
from opentelemetry.trace import Status, StatusCode


class LangChainToolMonitor(BaseCallbackHandler):
    """Observe callbacks only; input, output and error contents are ignored."""

    def __init__(self, tracer, *, max_inflight: int = 1024):
        if type(max_inflight) is not int or max_inflight < 1:
            raise ValueError("invalid_max_inflight")
        self._tracer = tracer
        self._max_inflight = max_inflight
        self._lock = threading.Lock()
        self._active = {}
        self._closed = False
        self._counts = {"started": 0, "completed": 0, "errors": 0,
                        "dropped": 0, "unmatched_end": 0, "incomplete": 0}

    def on_tool_start(self, serialized, input_str, *, run_id, **kwargs):
        with self._lock:
            if self._closed or run_id in self._active or len(self._active) >= self._max_inflight:
                self._counts["dropped"] += 1
                return
            name = serialized.get("name") if isinstance(serialized, dict) else None
            name = name if isinstance(name, str) and name else None
            attrs = {"gen_ai.operation.name": "execute_tool"}
            if name:
                attrs["gen_ai.tool.name"] = name
            span = self._tracer.start_span("execute_tool", attributes=attrs)
            self._active[run_id] = span
            self._counts["started"] += 1

    def _end(self, run_id, *, error=False):
        with self._lock:
            span = self._active.pop(run_id, None)
            if span is None:
                self._counts["unmatched_end"] += 1
                return
            self._counts["errors" if error else "completed"] += 1
        if error:
            span.set_status(Status(StatusCode.ERROR))
        span.end()

    def on_tool_end(self, output, *, run_id, **kwargs):
        self._end(run_id)

    def on_tool_error(self, error, *, run_id, **kwargs):
        self._end(run_id, error=True)

    def stats(self):
        with self._lock:
            return {**self._counts, "inflight": len(self._active)}

    def close(self):
        """End incomplete observations with unset status, without claiming failure."""
        with self._lock:
            self._closed = True
            remaining = list(self._active.values())
            self._active.clear()
            self._counts["incomplete"] += len(remaining)
        for span in remaining:
            span.end()
