"""Drop-in observation and optional permission enforcement around Python tools."""

import functools
import hashlib
import inspect
import json
import threading
import time
import uuid
from pathlib import Path

from .behavior import Policy
from .pipeline import run_pipeline


class SafetyPlugin:
    """Wrap only selected tools. Inputs, outputs and exception text are not saved.

    Resource identifiers and the trusted policy remain in the local run directory.
    Removing the wrapper detaches the plugin; it starts no service or scheduler.
    """

    def __init__(self, policy_path=None, output_dir=None, *, mode="observe"):
        if mode not in {"observe", "enforce"}:
            raise ValueError("invalid_plugin_mode")
        policy = (Policy.model_validate_json(Path(policy_path).read_bytes()) if policy_path is not None
                  else Policy(authoritative=False, allowed=[]))
        if mode == "enforce" and not policy.authoritative:
            raise ValueError("enforcement_requires_authoritative_policy")
        self._policy = policy
        self._allowed = {(r.action, r.resource) for r in policy.allowed}
        self.mode = mode
        output_dir = output_dir or Path("safety-runs") / (time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])
        self.output_dir = Path(output_dir).expanduser().resolve()
        self.output_dir.mkdir(parents=True, exist_ok=False)
        self._write("policy.json", policy.model_dump())
        self._lock = threading.RLock()
        self._events, self._monitor = [], []
        self._ids = set()
        self._active = 0
        self._closed = False
        self._summary = None

    def _write(self, name, value):
        with (self.output_dir / name).open("x", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)

    @property
    def events(self):
        with self._lock:
            return [dict(event) for event in self._events]

    def record_report(self, event_id, reported):
        """Attach the host agent's actual completion report to a recorded call."""
        if reported not in {"executed", "blocked", "unknown"}:
            raise ValueError("invalid_reported_outcome")
        with self._lock:
            if self._closed:
                raise RuntimeError("plugin_closed")
            for event in self._events:
                if event["id"] == event_id:
                    event["reported"] = reported
                    return
            raise ValueError("unknown_event_id")

    def _begin(self, name, action, resource, event_id, args, kwargs):
        resolved = resource(*args, **kwargs) if callable(resource) else resource
        if not isinstance(resolved, str) or not resolved or len(resolved) > 2048:
            raise ValueError("invalid_tool_resource")
        identity = event_id(*args, **kwargs) if callable(event_id) else event_id
        identity = uuid.uuid4().hex if identity is None else identity
        if not isinstance(identity, str) or not 1 <= len(identity) <= 256:
            raise ValueError("invalid_event_id")
        with self._lock:
            if self._closed:
                raise RuntimeError("plugin_closed")
            if identity in self._ids:
                raise ValueError("duplicate_event_id")
            self._ids.add(identity)
            self._active += 1
        return {"id": identity, "trace_id": uuid.uuid4().hex, "action": action, "resource": resolved,
                "tool": name, "start": time.time_ns(),
                "denied": self.mode == "enforce" and (action, resolved) not in self._allowed}

    def _finish(self, call, observed, status):
        with self._lock:
            self._events.append({"id": call["id"], "action": call["action"],
                                 "resource": call["resource"], "observed": observed})
            # Tool names are registered by this wrapper. Resource authorization
            # is evaluated separately against the frozen policy in behavior.json.
            self._monitor.append({"trace_id": call["trace_id"], "span_id": uuid.uuid4().hex[:16],
                                  "tool_name": call["tool"], "span_status": status,
                                  "tool_policy_result": "listed", "permission_result": "unknown",
                                  "tool_policy_sha256": None, "start_time_unix_nano": call["start"],
                                  "end_time_unix_nano": time.time_ns()})
            self._active -= 1

    def wrap_tool(self, tool, *, action="call", resource=None, name=None, event_id=None):
        """Return a sync or async wrapper; resource can be a trusted resolver.

        The resolver receives the same arguments as the tool and must identify
        the resource the tool actually accesses. It must not trust a model's
        claimed identity or permissions.
        """
        if not callable(tool) or not isinstance(action, str) or not 1 <= len(action) <= 256:
            raise ValueError("invalid_tool_binding")
        name = name or getattr(tool, "__name__", "tool")
        if not isinstance(name, str) or not name:
            raise ValueError("invalid_tool_name")
        resource = "tool:" + name if resource is None else resource

        async def async_wrapper(*args, **kwargs):
            call = self._begin(name, action, resource, event_id, args, kwargs)
            if call["denied"]:
                self._finish(call, "blocked", "ok")
                raise PermissionError("tool_blocked_by_configured_policy")
            try:
                result = await tool(*args, **kwargs)
            except BaseException:
                self._finish(call, "unknown", "error")
                raise
            self._finish(call, "executed", "ok")
            return result

        def sync_wrapper(*args, **kwargs):
            call = self._begin(name, action, resource, event_id, args, kwargs)
            if call["denied"]:
                self._finish(call, "blocked", "ok")
                raise PermissionError("tool_blocked_by_configured_policy")
            try:
                result = tool(*args, **kwargs)
            except BaseException:
                self._finish(call, "unknown", "error")
                raise
            self._finish(call, "executed", "ok")
            return result

        return functools.wraps(tool)(async_wrapper if inspect.iscoroutinefunction(tool) else sync_wrapper)

    def close(self):
        with self._lock:
            if self._summary is not None:
                return dict(self._summary)
            if self._active:
                raise RuntimeError("finish_active_tool_calls_before_close")
            self._closed = True
            self._write("behavior.json", {"schema_version": "1", "events": self._events})
            self._write("tool-policy.json", {"schema_version": "1", "authoritative": True,
                                            "allowed_tools": sorted({event["tool_name"] for event in self._monitor})})
            policy_hash = hashlib.sha256((self.output_dir / "tool-policy.json").read_bytes()).hexdigest()
            with (self.output_dir / "monitor.jsonl").open("x", encoding="utf-8", newline="\n") as stream:
                for event in self._monitor:
                    event["tool_policy_sha256"] = policy_hash
                    stream.write(json.dumps(event) + "\n")
            self._write("manifest.json", {"schema_version": "1", "behavior": {
                "trace": "behavior.json", "policy": "policy.json"}, "monitor_events": "monitor.jsonl"})
            self._summary = run_pipeline(self.output_dir / "manifest.json", self.output_dir / "report.json",
                                         self.output_dir / "report.html")
            return dict(self._summary)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
