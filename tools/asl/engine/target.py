"""Resolve the coding-agent target to run.

The public repo has no hardcoded paths: everything comes from the environment.

    ASL_NODE        path to a node binary
    ASL_DSH_BIN     path to the DSH CLI entry (lib/bin.js)
    ASL_DSH_HOME    DSH home directory for this run
    ASL_FIXTURES    scratch dir for fixtures
    ASL_EVIDENCE    scratch dir for evidence
    ASL_SANDBOX_SHIM_DIR   optional PATH prefix used by sandbox shims

`detect_target` returns (Target | None, reason) so callers can report BLOCKED instead of
crashing when the environment is incomplete.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


def _env_path(name: str) -> Path | None:
    v = os.environ.get(name)
    return Path(v).expanduser() if v else None


@dataclass
class Target:
    name: str
    node: Path
    dsh_bin: Path
    dsh_home: Path
    fixture_root: Path
    evidence_root: Path
    model_driver: str = "real"

    def env(self) -> dict[str, str]:
        env = dict(os.environ)
        env["DSH_HOME"] = str(self.dsh_home)
        shim = os.environ.get("ASL_SANDBOX_SHIM_DIR")
        parts = [str(self.node.parent)] + ([shim] if shim else []) + [env.get("PATH", "")]
        env["PATH"] = os.pathsep.join(p for p in parts if p)
        env.setdefault("DSH_PERMISSION_MODE", "workspace-write")
        # The sandbox backend prepares its workspace under TMPDIR. On hosts where the root
        # overlay is full, leaving TMPDIR at /tmp makes the backend unavailable and the agent
        # degrades to editing files without ever running anything -- silently. ASL_TMP_ROOT
        # defaults to /dev/shm because it is usually the roomiest mount.
        tmp_root = env.get("ASL_TMP_ROOT", "/dev/shm")
        if tmp_root and Path(tmp_root).is_dir():
            tmp = Path(tmp_root) / "asl-tmp" / self.dsh_home.name
            tmp.mkdir(parents=True, exist_ok=True)
            env["TMPDIR"] = str(tmp)
            env["TMP"] = str(tmp)
            env["TEMP"] = str(tmp)
        return env

    def run_dsh(self, args, cwd: Path, timeout: int = 180, stdin_text: str | None = None):
        return subprocess.run([str(self.node), str(self.dsh_bin), *args],
                              cwd=str(cwd), env=self.env(), capture_output=True,
                              text=True, timeout=timeout, check=False, input=stdin_text)


def detect_target(node: Path | None = None, dsh_bin: Path | None = None,
                  fixture_root: Path | None = None,
                  evidence_root: Path | None = None) -> tuple[Target | None, str]:
    node = node or _env_path("ASL_NODE")
    dsh_bin = dsh_bin or _env_path("ASL_DSH_BIN")
    if node is None:
        return None, "BLOCKED: set ASL_NODE to a node binary"
    if not node.is_file():
        return None, f"BLOCKED: node runtime missing at {node}"
    if dsh_bin is None:
        return None, "BLOCKED: set ASL_DSH_BIN to the DSH CLI entry (lib/bin.js)"
    if not dsh_bin.is_file():
        return None, f"BLOCKED: dsh bin missing at {dsh_bin}"

    probe = subprocess.run([str(node), str(dsh_bin), "--version"], capture_output=True,
                           text=True, timeout=60, check=False)
    if probe.returncode != 0:
        return None, f"BLOCKED: dsh --version failed rc={probe.returncode} {probe.stderr[:200]}"
    version = (probe.stdout or "").strip()

    home = _env_path("ASL_DSH_HOME") or Path("/dev/shm/asl-dsh-home")
    fixture_root = Path(fixture_root or os.environ.get("ASL_FIXTURES", "/dev/shm/asl-fixtures"))
    evidence_root = Path(evidence_root or os.environ.get("ASL_EVIDENCE", "/dev/shm/asl-evidence"))
    for d in (home, fixture_root, evidence_root):
        d.mkdir(parents=True, exist_ok=True)

    return Target(name=f"dsh {version}", node=node, dsh_bin=dsh_bin, dsh_home=home,
                  fixture_root=fixture_root, evidence_root=evidence_root), ""


def cleanup(target: Target | None) -> None:
    if target is None:
        return
    shutil.rmtree(target.dsh_home, ignore_errors=True)
