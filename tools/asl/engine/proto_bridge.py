"""The 404 is a protocol mismatch: DSH speaks Anthropic Messages (/v1/messages), the
providers speak OpenAI Chat Completions (/v1/chat/completions).

So the proxy must TRANSLATE, not just forward:
  Anthropic request  -> OpenAI request
  OpenAI response    -> Anthropic SSE stream (message_start / content_block_* / message_delta)

This also gives us something valuable: a single place to see exactly what the model does
with the carrier, in a format we control.
"""
from __future__ import annotations
import json


def anthropic_to_openai(req: dict) -> dict:
    """Map an Anthropic Messages request onto Chat Completions."""
    msgs = []
    sys_prompt = req.get("system")
    if isinstance(sys_prompt, list):
        sys_prompt = "".join(b.get("text", "") for b in sys_prompt if isinstance(b, dict))
    if sys_prompt:
        msgs.append({"role": "system", "content": sys_prompt})

    for m in req.get("messages") or []:
        role = m.get("role") or "user"
        content = m.get("content")
        if isinstance(content, str):
            msgs.append({"role": role, "content": content})
            continue
        parts_text, tool_calls, tool_results = [], [], []
        for b in (content or []):
            if not isinstance(b, dict):
                continue
            t = b.get("type")
            if t == "text":
                parts_text.append(b.get("text") or "")
            elif t == "tool_use":
                tool_calls.append({
                    "id": b.get("id") or "call_0",
                    "type": "function",
                    "function": {"name": b.get("name") or "tool",
                                 "arguments": json.dumps(b.get("input") or {})},
                })
            elif t == "tool_result":
                inner = b.get("content")
                if isinstance(inner, list):
                    inner = "".join(x.get("text", "") for x in inner
                                    if isinstance(x, dict))
                tool_results.append({"role": "tool",
                                     "tool_call_id": b.get("tool_use_id") or "call_0",
                                     "content": str(inner)[:20000]})
        if tool_results:
            msgs.extend(tool_results)
        if tool_calls:
            msgs.append({"role": "assistant",
                         "content": "".join(parts_text) or None,
                         "tool_calls": tool_calls})
        elif parts_text:
            msgs.append({"role": role, "content": "".join(parts_text)})

    out = {"model": req.get("model"), "messages": msgs,
           "max_tokens": req.get("max_tokens") or 4096}
    if req.get("temperature") is not None:
        out["temperature"] = req["temperature"]
    tools = req.get("tools")
    if tools:
        out["tools"] = [{"type": "function",
                         "function": {"name": t.get("name"),
                                      "description": (t.get("description") or "")[:1024],
                                      "parameters": t.get("input_schema")
                                      or {"type": "object", "properties": {}}}}
                        for t in tools if isinstance(t, dict) and t.get("name")]
        if req.get("tool_choice"):
            tc = req["tool_choice"]
            if isinstance(tc, dict) and tc.get("type") == "auto":
                out["tool_choice"] = "auto"
    return out


def openai_to_anthropic_sse(resp: dict, model: str) -> bytes:
    """Render a Chat Completions response as an Anthropic SSE stream."""
    ch = (resp.get("choices") or [{}])[0]
    msg = ch.get("message") or {}
    finish = ch.get("finish_reason") or "end_turn"
    stop = {"tool_calls": "tool_use", "length": "max_tokens",
            "stop": "end_turn"}.get(finish, "end_turn")
    usage = resp.get("usage") or {}
    ev = [
        ("message_start", {"type": "message_start", "message": {
            "id": resp.get("id") or "msg_1", "type": "message", "role": "assistant",
            "model": model, "content": [], "stop_reason": None, "stop_sequence": None,
            "usage": {"input_tokens": usage.get("prompt_tokens") or 0,
                      "output_tokens": 0}}}),
    ]
    idx = 0
    text = msg.get("content")
    if text:
        ev.append(("content_block_start", {"type": "content_block_start", "index": idx,
                                           "content_block": {"type": "text", "text": ""}}))
        ev.append(("content_block_delta", {"type": "content_block_delta", "index": idx,
                                           "delta": {"type": "text_delta", "text": text}}))
        ev.append(("content_block_stop", {"type": "content_block_stop", "index": idx}))
        idx += 1
    for tc in (msg.get("tool_calls") or []):
        fn = tc.get("function") or {}
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except Exception:
            args = {}
        ev.append(("content_block_start", {"type": "content_block_start", "index": idx,
                                           "content_block": {"type": "tool_use",
                                                             "id": tc.get("id") or "tool_0",
                                                             "name": fn.get("name"),
                                                             "input": {}}}))
        ev.append(("content_block_delta", {"type": "content_block_delta", "index": idx,
                                           "delta": {"type": "input_json_delta",
                                                     "partial_json": json.dumps(args)}}))
        ev.append(("content_block_stop", {"type": "content_block_stop", "index": idx}))
        idx += 1
    ev.append(("message_delta", {"type": "message_delta",
                                 "delta": {"stop_reason": stop, "stop_sequence": None},
                                 "usage": {"output_tokens": usage.get("completion_tokens") or 0}}))
    ev.append(("message_stop", {"type": "message_stop"}))
    return "".join(f"event: {a}\ndata: {json.dumps(b)}\n\n" for a, b in ev).encode()
