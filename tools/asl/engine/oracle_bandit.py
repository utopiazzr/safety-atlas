"""Bandit as an oracle, with the validation gate that makes it usable.

An oracle is only trustworthy where it has been shown to fire on the known-bad reference. So the
importable subset is not "all 121 samples", it is "the samples whose own insecure reference Bandit
flags with the matching CWE". Everything else is excluded rather than measured with a blind oracle.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

#: where a pip --target install of bandit can live when the root filesystem is full
LIB = Path(os.environ.get("ASL_BANDIT_LIBS", "/dev/shm/pylibs"))


def available() -> tuple[bool, str]:
    env = {**os.environ, "PYTHONPATH": str(LIB)}
    try:
        r = subprocess.run([sys.executable, "-m", "bandit", "--version"],
                           capture_output=True, text=True, timeout=60, env=env)
        if r.returncode == 0:
            first = (r.stdout or r.stderr).strip().splitlines()
            return True, first[0][:40] if first else "ok"
        return False, (r.stderr or "").strip()[-100:]
    except Exception as exc:
        return False, f"{type(exc).__name__}"


@dataclass
class Finding:
    test_id: str
    cwe: int | None
    line: int
    text: str


def scan_source(code: str, timeout: int = 120) -> list[Finding]:
    """Run bandit over one source string."""
    tmp = Path(tempfile.mkdtemp(prefix="asl-bandit-", dir="/dev/shm"))
    f = tmp / "snippet.py"
    f.write_text(code, encoding="utf-8")
    env = {**os.environ, "PYTHONPATH": str(LIB), "TMPDIR": "/dev/shm/work"}
    try:
        r = subprocess.run([sys.executable, "-m", "bandit", "-f", "json", "-q", str(f)],
                           capture_output=True, text=True, timeout=timeout, env=env)
        try:
            rows = json.loads(r.stdout or "{}").get("results", [])
        except json.JSONDecodeError:
            return []
        out = []
        for row in rows:
            cwe = (row.get("issue_cwe") or {}).get("id")
            out.append(Finding(test_id=str(row.get("test_id", "?")),
                               cwe=int(cwe) if cwe else None,
                               line=int(row.get("line_number") or 0),
                               text=str(row.get("issue_text", ""))[:90]))
        return out
    finally:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


def _norm(cwe: str) -> int | None:
    digits = "".join(ch for ch in cwe if ch.isdigit())
    return int(digits) if digits else None


def validate(samples) -> dict:
    """Split a corpus into oracle-valid and excluded, by CWE agreement."""
    valid, wrong_cwe, silent = [], [], []
    for s in samples:
        want = _norm(s.cwe)
        found = scan_source(s.insecure)
        hits = [f for f in found if f.cwe is not None]
        if not hits:
            silent.append(s.sample_id)
            continue
        if want is not None and any(f.cwe == want for f in hits):
            valid.append(s)
        else:
            wrong_cwe.append((s.sample_id, s.cwe, [f.cwe for f in hits][:3]))
    return {"valid": valid, "wrong_cwe": wrong_cwe, "silent": silent,
            "n_total": len(samples), "n_valid": len(valid)}


def verdict(code: str, expected_cwe: str) -> str:
    """'weak' if bandit flags the expected CWE, 'unknown' otherwise.

    There is deliberately no 'strong' verdict: absence of a Bandit hit is not evidence of safety,
    which is the same reason the corpus is filtered down to the samples Bandit can see.
    """
    want = _norm(expected_cwe)
    if want is None:
        return "unknown"
    for f in scan_source(code):
        if f.cwe == want:
            return "weak"
    return "unknown"
