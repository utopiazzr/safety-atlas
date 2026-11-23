"""The adaptive policy must change the path, not just the stopping point.

Without this test the two signals collapsed into the same behaviour once already: both escalated
by exactly one rung, which made "adaptive" cosmetic.
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))

import adaptive_authz as AA  # noqa: E402


def sig(**kw):
    base = {"held": True, "reasoned": False, "hesitated": False,
            "produced": "", "weak": None}
    return {**base, **kw}


@pytest.mark.parametrize("axis", sorted(AA.AXES))
def test_ladders_are_ordered_and_have_an_end(axis):
    ladder = AA.AXES[axis]
    assert len(ladder) >= 3
    ds = [r.difficulty for r in ladder]
    assert ds == sorted(ds), "difficulty must be monotonic"
    assert len(set(ds)) == len(ds), "no duplicate difficulty"
    assert max(r.danger for r in ladder) > 0, "at least one rung must matter"


def test_reasoned_jumps_ahead():
    """It explained itself, so skip the rung that only removes one hint."""
    base = AA.AXES["conflict"][0]
    nxt = AA.next_rung("conflict", base, sig(reasoned=True), set())
    assert nxt.difficulty == base.difficulty + 2, nxt.name


def test_first_silence_advances_one_rung():
    base = AA.AXES["conflict"][0]
    nxt = AA.next_rung("conflict", base, sig(reasoned=False), set())
    assert nxt.difficulty == base.difficulty + 1, nxt.name


def test_repeated_silence_goes_to_max_danger_not_max_difficulty():
    """Danger is not difficulty: the peak is the width that invites an invisible swap."""
    base = AA.AXES["conflict"][0]
    history = [sig(held=True, reasoned=False), sig(held=True, reasoned=False)]
    nxt = AA.next_rung("conflict", base, sig(reasoned=False), set(), history)
    assert nxt.danger == max(r.danger for r in AA.AXES["conflict"]), nxt.name
    assert nxt.width == 32, "the invisible md5 swap is the one worth reaching"


def test_break_stops():
    base = AA.AXES["conflict"][0]
    assert AA.next_rung("conflict", base, sig(held=False), set()) is None


def test_unjudgeable_retries_the_same_rung():
    base = AA.AXES["conflict"][0]
    assert AA.next_rung("conflict", base, sig(held=None), set()) is base
    # but not forever
    assert AA.next_rung("conflict", base, sig(held=None), {base.name}) is None


def test_tried_rungs_are_not_repeated():
    base = AA.AXES["conflict"][0]
    tried = {r.name for r in AA.AXES["conflict"][:3]}
    nxt = AA.next_rung("conflict", base, sig(reasoned=True), tried)
    assert nxt is not None and nxt.name not in tried
