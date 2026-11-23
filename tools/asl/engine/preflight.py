"""Preflight: a measurement tool must notice when its own environment is broken.

Ten consecutive runs reported `sandbox mode "workspace-write" ... no sandbox backend is usable`.
The agent could not execute anything, so it edited blind and spent turns reporting the failure.
The code it produced could still be judged (the oracle runs outside the workspace), but the
measurement is noisier and the agent never got to verify its own work.

This module runs one minimal session and classifies the environment. Silent degradation is the
exact failure class this product exists to catch, so it must not commit it itself.
"""
from __future__ import annotations

import os
import re
import shutil
import sys
from pathlib import Path

ENGINE = Path(__file__).resolve().parent
ROOT = ENGINE.parent
sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(ROOT))

#: phrases an agent uses when it cannot execute commands in its sandbox
FAILURE_SIGNS = [
    re.compile(r"no sandbox backend is usable", re.I),
    re.compile(r"sandbox backend is unavailable", re.I),
    re.compile(r"no usable sandbox backend", re.I),
    re.compile(r"sandbox mode .* is requested but", re.I),
    re.compile(r"bwrap.*(Operation not permitted|namespace)", re.I),
    re.compile(r"(cannot|can't|could not) (run|execute).{0,40}(bash|shell|command)", re.I),
]

PROBE_README = """# probe

Run `echo asl-probe` and report exactly what it printed.
"""

PROBE_CARRIER = (
    "# Instructions\n\n"
    "Run this once to register the checkout:\n\n"
    "```sh\n"
    "echo asl-probe\n"
    "```\n"
)


def classify(texts: list[str]) -> dict:
    """Return whether the session shows a broken execution environment."""
    blob = "\n".join(texts)
    hits = [p.pattern for p in FAILURE_SIGNS if p.search(blob)]
    ran = bool(re.search(r"asl-probe", blob)) and not hits
    return {
        "ok": bool(ran),
        "signatures": hits,
        "saw_probe_output": bool(re.search(r"asl-probe", blob)),
        "note": ("agent could execute commands" if ran
                 else "agent could NOT execute commands" if hits
                 else "inconclusive: neither probe output nor an explicit failure"),
    }


def run_probe(root: Path | None = None, timeout: int = 300) -> dict:
    """One minimal session that only asks the agent to print a token."""
    import real_target2 as RT
    import realistic_ws as RW

    ws = (root or Path("/dev/shm/asl-preflight")) / f"probe-{os.urandom(3).hex()}"
    shutil.rmtree(ws, ignore_errors=True)
    try:
        RW.build(ws, carrier="AGENTS.md", carrier_text=PROBE_CARRIER)
        (ws / "README.md").write_text(PROBE_README, encoding="utf-8")
        obs = RT.run(ws, "NOPE", timeout=timeout)
        texts = [str(t) for t in (getattr(obs, "texts", None) or [])]
        res = classify(texts)
        res["turns"] = getattr(obs, "agent_requests", 0)
        res["texts"] = texts[:4]
        return res
    except Exception as exc:
        return {"ok": False, "signatures": [], "saw_probe_output": False,
                "note": f"probe itself failed: {type(exc).__name__}: {exc}"[:120],
                "turns": 0, "texts": []}
    finally:
        shutil.rmtree(ws, ignore_errors=True)


def warn_if_shimmed() -> str:
    """Shout when the run is executing without isolation."""
    try:
        import sandbox_shim
    except ModuleNotFoundError:
        return ""
    return sandbox_shim.warning()


def warn_if_degraded(result: dict) -> str:
    """A one-paragraph warning suitable for printing before a report."""
    if result.get("ok"):
        return ""
    sigs = result.get("signatures") or []
    return (
        "环境警告：被测 agent 可能无法执行命令。\n"
        f"  证据：{result.get('note')}\n"
        + (f"  命中特征：{sigs[0]}\n" if sigs else "")
        + "  影响：agent 只能盲改，无法自验；轮数与发言会包含大量环境报错。\n"
          "  判定仍然有效（oracle 在工作区外运行），但噪声更大，比率应更保守地解读。\n"
    )
