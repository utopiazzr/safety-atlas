"""Read the trace subset of OpenTelemetry OTLP JSON without exporting payloads."""

import hashlib
import json
import re
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ToolPolicy(BaseModel):
    """An explicit tool-name allowlist; it does not describe resource access."""

    model_config = ConfigDict(extra="forbid", strict=True)
    schema_version: str
    authoritative: bool
    allowed_tools: list[str] = Field(default_factory=list)

    @field_validator("schema_version")
    @classmethod
    def validate_version(cls, value: str) -> str:
        if value != "1":
            raise ValueError("unsupported_tool_policy_version")
        return value

    @field_validator("allowed_tools")
    @classmethod
    def validate_tools(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values) or any(not item or not item.strip() for item in values):
            raise ValueError("invalid_allowed_tools")
        return values


def _attributes(span: dict) -> dict:
    attributes = span.get("attributes", [])
    if not isinstance(attributes, list):
        raise ValueError("invalid_span_attributes")
    result = {}
    for item in attributes:
        if not isinstance(item, dict) or not isinstance(item.get("key"), str) or not isinstance(item.get("value"), dict):
            raise ValueError("invalid_span_attribute")
        key = item["key"]
        if key in result:
            raise ValueError("duplicate_span_attribute")
        value = item["value"]
        result[key] = value.get("stringValue", value.get("intValue"))
    return result


def summarize_otel(path: str | Path, policy_path: str | Path | None = None) -> dict:
    raw = Path(path).expanduser().read_bytes()
    policy_hash = None
    policy = None
    if policy_path is not None:
        policy_raw = Path(policy_path).expanduser().read_bytes()
        policy = ToolPolicy.model_validate_json(policy_raw)
        policy_hash = hashlib.sha256(policy_raw).hexdigest()
    try:
        documents = [json.loads(raw)]
    except json.JSONDecodeError:
        documents = [json.loads(line) for line in raw.splitlines() if line.strip()]
    if not documents:
        raise ValueError("invalid_otlp_trace")
    records = []
    seen = set()
    resources = []
    for document in documents:
        if not isinstance(document, dict) or not isinstance(document.get("resourceSpans"), list):
            raise ValueError("invalid_otlp_trace")
        resources.extend(document["resourceSpans"])
    for resource in resources:
        if not isinstance(resource, dict) or not isinstance(resource.get("scopeSpans", []), list):
            raise ValueError("invalid_otlp_trace")
        for scope in resource.get("scopeSpans", []):
            if not isinstance(scope, dict) or not isinstance(scope.get("spans", []), list):
                raise ValueError("invalid_otlp_trace")
            for span in scope.get("spans", []):
                if not isinstance(span, dict):
                    raise ValueError("invalid_otlp_span")
                trace_id, span_id = span.get("traceId"), span.get("spanId")
                if (not isinstance(trace_id, str) or not re.fullmatch(r"[0-9a-fA-F]{32}", trace_id)
                        or not isinstance(span_id, str) or not re.fullmatch(r"[0-9a-fA-F]{16}", span_id)):
                    raise ValueError("invalid_otlp_span_identity")
                identity = (trace_id.lower(), span_id.lower())
                if identity in seen:
                    raise ValueError("duplicate_otlp_span")
                seen.add(identity)
                attributes = _attributes(span)
                if attributes.get("gen_ai.operation.name") != "execute_tool":
                    continue
                status = span.get("status", {})
                if not isinstance(status, dict):
                    raise ValueError("invalid_span_status")
                code = status.get("code", 0)
                if type(code) not in (int, str):
                    raise ValueError("invalid_span_status")
                status_name = {0: "unset", 1: "ok", 2: "error", "STATUS_CODE_UNSET": "unset",
                               "STATUS_CODE_OK": "ok", "STATUS_CODE_ERROR": "error"}.get(code)
                if status_name is None:
                    raise ValueError("invalid_span_status")
                tool = attributes.get("gen_ai.tool.name")
                tool = tool if isinstance(tool, str) and tool else None
                tool_policy_result = "unknown"
                if policy is not None and policy.authoritative and tool is not None:
                    tool_policy_result = "listed" if tool in policy.allowed_tools else "unlisted"
                records.append({"trace_id": identity[0], "span_id": identity[1],
                                "tool_name": tool, "tool_policy_result": tool_policy_result,
                                "span_status": status_name,
                                "permission_result": "unknown"})
    return {"source_sha256": hashlib.sha256(raw).hexdigest(),
            "tool_policy_sha256": policy_hash,
            "tool_policy_authoritative": bool(policy and policy.authoritative),
            "format": "otlp_json_trace", "tool_span_count": len(records),
            "tool_spans": records, "scope": "imported_spans_only_not_live_monitoring"}
