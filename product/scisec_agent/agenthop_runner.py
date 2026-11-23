"""Run prepared, non-attacking questions through an OpenAI-compatible endpoint.

Only question views are sent. The answer-key file is read locally to verify the
prepared bundle, never transmitted to the endpoint. No tools are invoked.
"""

import json
import http.client
import math
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from .agenthop import validate_prepared


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _completion_url(base_url: str) -> str:
    parsed = urllib.parse.urlsplit(base_url)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname or
            parsed.username is not None or parsed.password is not None or
            parsed.query or parsed.fragment):
        raise ValueError("invalid_provider_url")
    if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("provider_https_required")
    return base_url.rstrip("/") + "/chat/completions"


def run_questions(dataset_path: str | Path, prepared_path: str | Path, answers_path: str | Path,
                  *, base_url: str, model: str, api_key_env: str = "LLM_API_KEY",
                  timeout_seconds: float = 60) -> dict:
    """Write successful answers as JSONL; report failures separately without retries."""
    if not model.strip() or not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ValueError("invalid_model_or_timeout")
    token = os.environ.get(api_key_env)
    if not token:
        raise ValueError("provider_key_missing")
    url = _completion_url(base_url)
    prepared = json.loads(Path(prepared_path).expanduser().read_bytes())
    bundle = validate_prepared(dataset_path, prepared)
    opener = urllib.request.build_opener(_NoRedirect)
    outcomes = []
    # Exclusive creation prevents accidentally overwriting user files. Each
    # successful record is flushed so a later failure leaves usable results.
    with Path(answers_path).expanduser().open("x", encoding="utf-8", newline="\n") as output:
        for task in bundle["tasks"]:
            usage = None
            public_question = {key: task[key] for key in ("question", "options", "seed_arxiv_id", "seed_title")}
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "Answer the multiple-choice question. Return only JSON with integer answer_index from 0 to 3."},
                    {"role": "user", "content": json.dumps(public_question, ensure_ascii=False)},
                ],
                "temperature": 0,
            }
            request = urllib.request.Request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                                             headers={"Authorization": "Bearer " + token,
                                                      "Content-Type": "application/json"}, method="POST")
            try:
                with opener.open(request, timeout=timeout_seconds) as response:
                    body = response.read(1024 * 1024 + 1)
                if len(body) > 1024 * 1024:
                    raise ValueError("provider_response_too_large")
                data = json.loads(body)
                reported = data.get("usage") if isinstance(data, dict) else None
                if (isinstance(reported, dict) and type(reported.get("prompt_tokens")) is int
                        and type(reported.get("completion_tokens")) is int
                        and reported["prompt_tokens"] >= 0 and reported["completion_tokens"] >= 0):
                    usage = {"prompt_tokens": reported["prompt_tokens"],
                             "completion_tokens": reported["completion_tokens"]}
                answer = json.loads(data["choices"][0]["message"]["content"])
                index = answer.get("answer_index") if isinstance(answer, dict) else None
                if type(index) is not int or index not in range(4):
                    raise ValueError("invalid_model_answer")
            except urllib.error.HTTPError as exc:
                outcomes.append({"sample_id": task["sample_id"], "status": "provider_http_error", "http_status": exc.code, "usage": None})
                continue
            except (urllib.error.URLError, OSError, http.client.HTTPException):
                outcomes.append({"sample_id": task["sample_id"], "status": "provider_connection_error", "usage": None})
                continue
            except (ValueError, KeyError, IndexError, TypeError, UnicodeDecodeError):
                outcomes.append({"sample_id": task["sample_id"], "status": "invalid_provider_response", "usage": usage})
                continue
            output.write(json.dumps({"sample_id": task["sample_id"], "answer_index": index}) + "\n")
            output.flush()
            outcomes.append({"sample_id": task["sample_id"], "status": "answered", "usage": usage})
    answered = sum(item["status"] == "answered" for item in outcomes)
    known = [item["usage"] for item in outcomes if item["usage"] is not None]
    return {
        "source": bundle["source"], "source_file_sha256": bundle["source_file_sha256"],
        "model": model, "requested_count": len(outcomes), "answered_count": answered,
        "failed_count": len(outcomes) - answered, "answers_path": str(Path(answers_path).resolve()),
        "results": outcomes,
        "usage": {"requests_with_usage": len(known), "requests_without_usage": len(outcomes) - len(known),
                  "reported_prompt_tokens": sum(u["prompt_tokens"] for u in known) if known else None,
                  "reported_completion_tokens": sum(u["completion_tokens"] for u in known) if known else None},
        "scope": "question_only_not_official_agenthop_evaluation",
    }
