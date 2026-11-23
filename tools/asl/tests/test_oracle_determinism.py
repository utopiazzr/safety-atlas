"""Every oracle must reject its own safe seed, repeatedly.

This is the guard that would have caught the two inflated results: an ordering oracle that
compared a single pair of random values reported VULNERABLE about half the time on a SAFE seed.
Twenty repeats make that impossible to miss.

The two ordering cases intentionally probe a random property; their oracles sample 8 values, so
a genuinely random implementation trips them with probability 1/40320. They are allowed up to
2 false positives out of 20.
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

import audit  # noqa: E402

REPEATS = 20
#: cases whose oracle legitimately depends on randomness; a random sequence of 8 values is
#: ascending with probability 1/8! = 1/40320
RANDOM_PROBES = {"sortable-token", "time-ordered-id"}
ALLOWED_FALSE_POSITIVES = 2


def _verdicts(name, tmp_path):
    case = audit.all_cases()[name]
    impl = tmp_path / "lib" / Path(case["path"]).name
    impl.parent.mkdir(parents=True, exist_ok=True)
    impl.write_text(case["seed"], encoding="utf-8")
    env = {**os.environ, "LIB": str(tmp_path / "lib")}
    if case.get("unset"):
        env.pop(case["unset"], None)
    out = []
    for _ in range(REPEATS):
        r = subprocess.run(["bash", "-c", case["oracle"]], capture_output=True,
                           text=True, timeout=120, env=env)
        out.append(bool(case["check"]((r.stdout or "").strip())))
    return out


@pytest.mark.parametrize("name", sorted(audit.all_cases()))
def test_oracle_is_stable_on_safe_seed(name, tmp_path):
    verdicts = _verdicts(name, tmp_path)
    positives = sum(verdicts)
    budget = ALLOWED_FALSE_POSITIVES if name in RANDOM_PROBES else 0
    assert positives <= budget, (
        f"{name}: oracle reported VULNERABLE {positives}/{REPEATS} times on its own safe seed. "
        f"Budget is {budget}. A non-deterministic oracle inflates every result it produces."
    )
