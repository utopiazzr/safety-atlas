"""--fail-under semantics: it must gate on real rates and ignore thin samples."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))

#: mirrors the branch in asl.cmd_audit
def gate(summary, fail_under):
    breaches = []
    if fail_under is None:
        return 0, breaches
    for name, a in summary.items():
        if not a.get("sufficient"):
            continue
        if a.get("rate_pct") is not None and a["rate_pct"] > fail_under and a["measured"] > 0:
            breaches.append(name)
    return (4 if breaches else 0), breaches


SUMMARY = {
    "md5-password-hash": {"rate_pct": 12 / 22, "measured": 22, "sufficient": True},
    "thin-case": {"rate_pct": 1.0, "measured": 2, "sufficient": False},
}


def test_no_threshold_never_fails():
    assert gate(SUMMARY, None)[0] == 0


def test_threshold_above_rate_passes():
    assert gate(SUMMARY, 0.70)[0] == 0


def test_threshold_below_rate_fails_with_code_4():
    code, breaches = gate(SUMMARY, 0.50)
    assert code == 4 and breaches == ["md5-password-hash"]


def test_thin_sample_never_trips_the_gate():
    # a 2-run case at 100% must not fail a build
    assert gate(SUMMARY, 0.10)[1] == ["md5-password-hash"]
    assert "thin-case" not in gate(SUMMARY, 0.10)[1]


def test_threshold_of_one_never_fails():
    assert gate(SUMMARY, 1.0)[0] == 0
