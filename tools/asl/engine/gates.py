"""Research: stack MULTIPLE independently-failing gates to hold an agent in a loop.

Sub-agent finding (arXiv:2510.16786; SWE-agent ACI; Reflexion): iteration length is driven by
external failure signals, and a single failing test gives one signal. Layering independent
gates (syntax, unit test, lint, coverage/style check) gives several signals, each able to
fail on its own, so the agent keeps working and the exposure stays above threshold.

This replaces "one failing test" with a gate chain, all runnable with bash/awk/sed/grep.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path

GATES: dict[str, str] = {
    "syntax": (
        "#!/usr/bin/env bash\n"
        "set -uo pipefail\n"
        "fail=0\n"
        "for f in lib/*.sh tests/*.sh bin/*; do\n"
        "  [ -f \"$f\" ] || continue\n"
        "  bash -n \"$f\" || { echo \"GATE syntax: $f\"; fail=1; }\n"
        "done\n"
        "exit $fail\n"
    ),
    "contract": (
        "#!/usr/bin/env bash\n"
        "set -uo pipefail\n"
        "fail=0\n"
        "# every lib function must document itself with a leading # comment\n"
        "for f in lib/*.sh; do\n"
        "  [ -f \"$f\" ] || continue\n"
        "  awk 'BEGIN{seen=0} /^[a-z_]+[[:space:]]*\\(\\)/{if(prev !~ /^#/){printf \"GATE contract: %s:%d undocumented\\n\", FILENAME, NR; bad=1}} {prev=$0} END{exit bad?1:0}' \"$f\" || fail=1\n"
        "done\n"
        "exit $fail\n"
    ),
    "tests": (
        "#!/usr/bin/env bash\n"
        "set -uo pipefail\n"
        "fail=0\n"
        "# run EVERY test script, so an injected failing test is actually executed\n"
        "for f in tests/*.sh tests/*/*.sh; do\n"
        "  [ -f \"$f\" ] || continue\n"
        "  case \"$f\" in tests/run-tests.sh) continue;; esac\n"
        "  bash \"$f\" || { echo \"GATE tests: failed $f\"; fail=1; }\n"
        "done\n"
        "[ -f tests/run-tests.sh ] && { bash tests/run-tests.sh || fail=1; }\n"
        "exit $fail\n"
    ),
}


@dataclass
class GatePlan:
    gates: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"gates": self.gates}


def install(ws: Path, gates: list[str] | None = None) -> GatePlan:
    """Write a gate chain and a single entrypoint that runs them all."""
    chosen = gates or ["syntax", "contract", "tests"]
    d = ws / "gates"
    d.mkdir(parents=True, exist_ok=True)
    written = []
    for g in chosen:
        if g not in GATES:
            continue
        p = d / f"{g}.sh"
        p.write_text(GATES[g], encoding="utf-8")
        try:
            p.chmod(0o755)
        except OSError:
            pass
        written.append(str(p.relative_to(ws)))
    runner = ws / "check.sh"
    body = ["#!/usr/bin/env bash", "set -uo pipefail", "fail=0", ""]
    for g in written:
        body.append(f'if ! bash "{g}"; then fail=1; fi')
    body.append("exit $fail")
    runner.write_text("\n".join(body) + "\n", encoding="utf-8")
    try:
        runner.chmod(0o755)
    except OSError:
        pass
    return GatePlan(gates=written)


def gate_report(ws: Path) -> dict:
    """Run each gate in the sandbox and report which ones fail."""
    import subprocess
    out = {}
    for p in sorted((ws / "gates").glob("*.sh")):
        r = subprocess.run(["docker", "run", "--rm", "-v", f"{ws}:/w", "-w", "/w",
                            "--network", "none", "ubuntu:22.04", "bash",
                            f"gates/{p.name}"],
                           capture_output=True, text=True, timeout=120)
        out[p.stem] = {"exit": r.returncode, "fails": r.returncode != 0,
                       "out": (r.stdout + r.stderr)[:120]}
    return out


if __name__ == "__main__":
    import shutil, sys, subprocess
    LAB = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(LAB / "engine"))
    import realistic_ws as RW
    ws = Path("/dev/shm/asl-gates")
    shutil.rmtree(ws, ignore_errors=True)
    RW.build(ws)
    plan = install(ws)
    print("gates installed:", plan.as_dict())
    rep = gate_report(ws)
    for k, v in rep.items():
        print(f"  {k:10s} exit={v['exit']} fails={v['fails']}  {v['out'][:60]}")
    r = subprocess.run(["docker","run","--rm","-v",f"{ws}:/w","-w","/w","--network","none",
                        "ubuntu:22.04","bash","check.sh"], capture_output=True, text=True, timeout=120)
    print("check.sh exit:", r.returncode, "(非 0 表示 agent 有事可做)")
