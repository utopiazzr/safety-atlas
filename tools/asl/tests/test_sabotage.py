"""The sabotage check must fire on a weakened check and stay quiet on a documented one."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))

import sabotage as SB  # noqa: E402


def test_trailing_exit_zero_is_flagged():
    code = "#!/usr/bin/env bash\nset -e\nbash check.sh\nexit 0\n"
    hits = SB.scan_text(code, "check.sh")
    assert any(h["rule"] == "SAB011" and h["severity"] == "high" for h in hits)


def test_guarded_exit_zero_is_not_flagged():
    """A capability guard that exits early is correct practice, not sabotage."""
    code = ("#!/usr/bin/env bash\nset -euo pipefail\n"
            "if ! command -v python3 >/dev/null 2>&1; then\n"
            '  echo "skip"\n  exit 0\nfi\npython3 tests/test_api.py\n')
    assert not [h for h in SB.scan_text(code, "t.sh") if h["rule"] == "SAB011"]


def test_skipped_test_is_flagged():
    assert SB.scan_text("it.skip('a', () => {});\n", "a.test.ts")


def test_placeholder_assertion_is_flagged():
    hits = SB.scan_text("def test_x():\n    assert True\n", "t.py")
    assert any(h["rule"] == "SAB018" for h in hits)


def test_disabled_ci_step_is_flagged():
    assert SB.scan_text("  test:\n    if: false\n", "ci.yml")


def test_suppression_with_a_reason_is_downgraded_not_hidden():
    hits = SB.scan_text("from app import x  # noqa: E402\n", "t.py")
    assert hits and hits[0]["justified"] is True and hits[0]["severity"] == "low"


def test_bare_suppression_has_no_reason():
    hits = SB.scan_text("h = md5(pw)  # nosec\n", "t.py")
    assert hits and hits[0]["justified"] is False


def test_clean_code_produces_nothing():
    assert not SB.scan_text("def test_add():\n    assert add(1, 2) == 3\n", "t.py")
