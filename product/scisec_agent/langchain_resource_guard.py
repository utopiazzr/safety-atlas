"""Exact subject/resource/action checks using Casbin in LangChain middleware."""

import hashlib
import importlib.metadata
import logging
import threading
from pathlib import Path
from typing import Literal

import casbin
from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import ToolMessage
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .guard_events import DecisionRecorder


_MODEL = """
[request_definition]
r = sub, obj, act
[policy_definition]
p = sub, obj, act
[role_definition]
g = _, _
[policy_effect]
e = some(where (p.eft == allow))
[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
"""


class _LocalEnforcer(casbin.Enforcer):
    """Initialize the pinned Casbin engine without changing host loggers."""

    def __init__(self, model):
        # PyCasbin 2.8.0's default constructor globally disables Casbin loggers.
        # Use its initialization API with private disabled logger instances so
        # embedding the guard neither changes host logging nor logs principals.
        quiet = logging.Logger("scisec-casbin-private")
        quiet.disabled = True
        self.logger = quiet
        model.logger = quiet
        for section in model.values():
            for assertion in section.values():
                assertion.logger = quiet
        self.init_with_model_and_adapter(model)
        for manager in self.rm_map.values():
            manager.logger = quiet


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ToolBinding(_Strict):
    resource_arg: str = Field(min_length=1, max_length=256)
    action: str = Field(min_length=1, max_length=256)


class Grant(_Strict):
    subject_kind: Literal["user", "role"]
    subject: str = Field(min_length=1, max_length=256)
    resource: str = Field(min_length=1, max_length=2048)
    action: str = Field(min_length=1, max_length=256)


class Membership(_Strict):
    subject: str = Field(min_length=1, max_length=256)
    role: str = Field(min_length=1, max_length=256)


class ResourcePolicy(_Strict):
    schema_version: Literal["1"]
    authoritative: bool
    tools: dict[str, ToolBinding]
    grants: list[Grant]
    memberships: list[Membership] = Field(default_factory=list)

    @field_validator("tools")
    @classmethod
    def nonempty_tool_names(cls, value):
        if any(not name.strip() for name in value):
            raise ValueError("invalid_tool_name")
        return value

    @model_validator(mode="after")
    def nonblank_values(self):
        values = [v for item in self.tools.values() for v in (item.resource_arg, item.action)]
        values += [v for item in self.grants for v in (item.subject, item.resource, item.action)]
        values += [v for item in self.memberships for v in (item.subject, item.role)]
        if any(not v.strip() for v in values):
            raise ValueError("blank_policy_value")
        return self


class CasbinResourceMiddleware(AgentMiddleware):
    """Bind a trusted host-supplied subject and an immutable policy snapshot."""

    def __init__(self, policy_path: str | Path, *, subject: str, audit_sink=None):
        if not isinstance(subject, str) or not subject.strip():
            raise ValueError("trusted_subject_required")
        if importlib.metadata.version("pycasbin") != "2.8.0":
            raise ValueError("unsupported_casbin_version")
        raw = Path(policy_path).expanduser().read_bytes()
        policy = ResourcePolicy.model_validate_json(raw)
        if not policy.authoritative:
            raise ValueError("authoritative_resource_policy_required")
        model = casbin.Model()
        model.load_model_from_text(_MODEL)
        self._enforcer = _LocalEnforcer(model)
        for grant in policy.grants:
            prefix = "u:" if grant.subject_kind == "user" else "r:"
            self._enforcer.add_policy(prefix + grant.subject, grant.resource, grant.action)
        for membership in policy.memberships:
            self._enforcer.add_grouping_policy("u:" + membership.subject, "r:" + membership.role)
        self._subject = "u:" + subject
        self._bindings = dict(policy.tools)
        self._recorder = DecisionRecorder(hashlib.sha256(raw).hexdigest(), audit_sink)
        self._policy_lock = threading.Lock()
        self._errors_lock = threading.Lock()
        self._evaluation_errors = 0

    def _decision(self, request):
        call = request.tool_call
        call_id = call.get("id") if isinstance(call, dict) else None
        if not isinstance(call_id, str) or not call_id:
            raise ValueError("invalid_tool_call_id")
        name = call.get("name")
        binding = self._bindings.get(name) if isinstance(name, str) else None
        args = call.get("args")
        resource = args.get(binding.resource_arg) if binding and isinstance(args, dict) else None
        tool = request.tool
        allowed = False
        if (binding is not None and isinstance(resource, str) and resource.strip()
                and tool is not None and tool.name == name):
            try:
                with self._policy_lock:
                    allowed = bool(self._enforcer.enforce(self._subject, resource, binding.action))
            except Exception:
                with self._errors_lock:
                    self._evaluation_errors += 1
        self._recorder.record(call_id, name, allowed)
        if not allowed:
            return ToolMessage(content="Tool call blocked by configured resource policy.",
                               tool_call_id=call_id, status="error")
        return None

    def wrap_tool_call(self, request, handler):
        blocked = self._decision(request)
        return blocked if blocked is not None else handler(request)

    async def awrap_tool_call(self, request, handler):
        blocked = self._decision(request)
        return blocked if blocked is not None else await handler(request)

    def stats(self):
        with self._errors_lock:
            errors = self._evaluation_errors
        return {**self._recorder.stats(), "evaluation_errors": errors}
