"""A compact view of an existing SciSec episode, without executing it."""

import hashlib
import json
from pathlib import Path


def summarize_episode(path: str | Path) -> dict:
    source = Path(path).expanduser().resolve(strict=True)
    if not source.is_file():
        raise ValueError("episode_not_file")
    raw = source.read_bytes()
    record = json.loads(raw)
    if not isinstance(record, dict):
        raise ValueError("episode_not_object")
    final = record.get("final_result")
    final = final if isinstance(final, dict) else {}

    def section(name):
        value = final.get(name)
        return value if isinstance(value, dict) else {}

    def score_status(name):
        score = section(name).get("score")
        if not isinstance(score, (int, float)) or isinstance(score, bool):
            return "unknown"
        return "pass" if score == 1 else "fail"

    execution = section("execution").get("success")
    flags = section("security").get("flags")
    blocks = record.get("policy_blocks")
    return {
        "task_id": record.get("task_id"),
        "risk_profile": record.get("risk_profile"),
        "agent": record.get("agent"),
        "source": record.get("task_source"),
        "verifier_version": final.get("verifier_version") or record.get("verifier_version"),
        "functional": score_status("functional"),
        "execution": ("pass" if execution else "fail") if isinstance(execution, bool) else "unknown",
        "provenance": score_status("provenance"),
        "security": score_status("security"),
        "security_flag_count": len(flags) if isinstance(flags, dict) else None,
        "policy_block_count": len(blocks) if isinstance(blocks, list) else None,
        "episode_sha256": hashlib.sha256(raw).hexdigest(),
        "evidence_path": str(source),
        "scope": "existing_episode_only",
    }


def compare_episodes(before: str | Path, after: str | Path) -> dict:
    baseline = summarize_episode(before)
    candidate = summarize_episode(after)
    for field in ("task_id", "risk_profile", "source", "verifier_version"):
        if not baseline[field] or baseline[field] != candidate[field]:
            raise ValueError(f"incomparable_{field}")
    changes = {}
    for field in ("functional", "execution", "provenance", "security"):
        a, b = baseline[field], candidate[field]
        changes[field] = (
            "unknown" if "unknown" in (a, b)
            else "unchanged" if a == b
            else "improved" if b == "pass"
            else "regressed"
        )
    return {"baseline": baseline, "candidate": candidate, "changes": changes}
