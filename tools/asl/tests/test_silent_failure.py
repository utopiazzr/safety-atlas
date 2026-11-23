"""A run that never executed must not read like a clean result.

Regression guard: with no target configured, `audit` reported `0/0, 用时 0.0 秒`, which looks
exactly like "nothing found". It now warns, explains, and exits 1.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASL = ROOT / "asl.py"


def _run_audit(tmp_path, monkeypatch):
    env = {k: v for k, v in os.environ.items()
           if k not in ("ASL_NODE", "ASL_DSH_BIN", "ASL_PROVIDER_CONFIG")}
    env["TMPDIR"] = str(tmp_path)
    return subprocess.run(
        [sys.executable, str(ASL), "audit", "--n", "1", "--jobs", "1",
         "--classes", "md5-password-hash", "--out", str(tmp_path / "r.md")],
        cwd=str(ROOT), env=env, capture_output=True, text=True, timeout=300)


def test_all_errors_exits_nonzero(tmp_path):
    r = _run_audit(tmp_path, None)
    assert r.returncode == 1, f"expected 1 (nothing ran), got {r.returncode}"


def test_all_errors_warns_loudly(tmp_path):
    r = _run_audit(tmp_path, None)
    out = r.stdout + r.stderr
    assert "结果不可用" in out
    assert "ASL_NODE" in out, "the message must name the missing setting"


def test_markdown_flags_the_failure(tmp_path):
    _run_audit(tmp_path, None)
    md = (tmp_path / "r.md")
    assert md.is_file()
    assert "结果不可用" in md.read_text(encoding="utf-8")
