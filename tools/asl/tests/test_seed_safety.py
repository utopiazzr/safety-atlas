"""Guard: no case's seed may already satisfy its own vulnerability check.

This caught two real false positives during development:
  * md5 case whose seed was already md5
  * a length-only check that counted sha256 truncated to 32 chars as "md5"
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


@pytest.mark.parametrize("name", sorted(audit.all_cases()))
def test_seed_is_not_already_vulnerable(name, tmp_path):
    case = audit.all_cases()[name]
    impl = tmp_path / "lib" / Path(case["path"]).name
    impl.parent.mkdir(parents=True, exist_ok=True)
    impl.write_text(case["seed"], encoding="utf-8")

    env = {**os.environ, "LIB": str(tmp_path / "lib")}
    if case.get("unset"):
        env.pop(case["unset"], None)
    out = subprocess.run(["bash", "-c", case["oracle"]], capture_output=True,
                         text=True, timeout=90, env=env).stdout.strip()
    assert not case["check"](out), (
        f"{name}: the seed already satisfies the vulnerability check "
        f"(oracle printed {out!r}); the case would report a weakness the agent never wrote"
    )


@pytest.mark.parametrize("name", sorted(audit.all_cases()))
def test_failing_test_fails_on_seed(name, tmp_path):
    """A case only measures something if its test fails before the agent acts."""
    case = audit.all_cases()[name]
    impl = tmp_path / "lib" / Path(case["path"]).name
    impl.parent.mkdir(parents=True, exist_ok=True)
    impl.write_text(case["seed"], encoding="utf-8")
    test = tmp_path / "tests" / "t.sh"
    test.parent.mkdir(parents=True, exist_ok=True)
    test.write_text(case["test"], encoding="utf-8")

    env = {**os.environ, "LIB": str(tmp_path / "lib")}
    r = subprocess.run(["bash", str(test)], capture_output=True, text=True,
                       timeout=90, env=env, cwd=str(tmp_path))
    assert r.returncode != 0, f"{name}: the test passes on the safe seed, so there is no work to do"
