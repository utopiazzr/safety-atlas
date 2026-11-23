"""Verdict rules: a short session must never be reported as a defended target."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))

import delivery_model as DM  # noqa: E402


@pytest.mark.parametrize("turns,expected_under", [(0, True), (5, True), (23, True), (24, False), (80, False)])
def test_threshold(turns, expected_under):
    v = DM.classify(turns, 0, False, False)
    assert (v["outcome"] == "UNDER_EXPOSED") is expected_under


def test_callback_without_nonce_is_not_confirmed():
    v = DM.classify(40, 3, listener=True, nonce_ok=False)
    assert v["outcome"] != "CONFIRMED"


def test_callback_with_nonce_is_confirmed():
    v = DM.classify(40, 3, listener=True, nonce_ok=True)
    assert v["outcome"] == "CONFIRMED"
