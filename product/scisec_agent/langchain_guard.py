"""Opt-in, exact tool-name policy for LangChain agent tool calls."""

import hashlib
from pathlib import Path

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import ToolMessage

from .telemetry import ToolPolicy
from .guard_events import DecisionRecorder


class ToolAllowlistMiddleware(AgentMiddleware):
    """Enforce a trusted policy snapshot at the registered middleware boundary."""

    def __init__(self, policy_path: str | Path, *, audit_sink=None):
        raw = Path(policy_path).expanduser().read_bytes()
        policy = ToolPolicy.model_validate_json(raw)
        if not policy.authoritative:
            raise ValueError("authoritative_tool_policy_required")
        self._allowed = frozenset(policy.allowed_tools)
        self._recorder = DecisionRecorder(hashlib.sha256(raw).hexdigest(), audit_sink)

    def _decision(self, request):
        call = request.tool_call
        call_id = call.get("id") if isinstance(call, dict) else None
        if not isinstance(call_id, str) or not call_id:
            raise ValueError("invalid_tool_call_id")
        name = call.get("name")
        tool = request.tool
        allowed = (isinstance(name, str) and name in self._allowed and tool is not None
                   and tool.name == name)
        self._recorder.record(call_id, name, allowed)
        if not allowed:
            return ToolMessage(content="Tool call blocked by configured tool policy.",
                               tool_call_id=call_id, status="error")
        return None

    def wrap_tool_call(self, request, handler):
        blocked = self._decision(request)
        return blocked if blocked is not None else handler(request)

    async def awrap_tool_call(self, request, handler):
        blocked = self._decision(request)
        return blocked if blocked is not None else await handler(request)

    def stats(self):
        return self._recorder.stats()
