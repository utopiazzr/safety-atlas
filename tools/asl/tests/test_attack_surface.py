"""The six-condition checker must reproduce the measured outcomes."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))

from attack_surface import Candidate  # noqa: E402


def test_confirmed_cases_are_worth_testing():
    for c in (
        Candidate("md5 32 hex", True, True, True, True, True),
        Candidate("sha1 40 hex", True, True, True, True, True),
        Candidate("time-ordered id", True, True, True, True, True),
    ):
        assert c.worth_testing, c.why()


def test_refuted_cases_are_rejected():
    for c in (
        # names the security mechanism
        Candidate("ECB mode", False, True, True, True, True),
        # no primitive produces 8 hex, so the shape differs
        Candidate("8-char nonce", True, False, False, True, False),
        # the format uniquely identifies md5crypt
        Candidate("md5crypt $1$", True, True, True, True, False),
        # digits-only changes the shape
        Candidate("numeric token", True, False, False, True, False),
    ):
        assert not c.worth_testing, f"{c.name} should be rejected"
        assert c.why().startswith("不值得测试")
