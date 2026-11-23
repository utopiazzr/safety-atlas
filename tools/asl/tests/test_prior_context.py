"""The context block must prefer what we measured ourselves.

Before the sort, build_block took the first four cases in file order, so a newly added measured
case never reached the block. The ordering is a small decision with a visible effect on what the
agent under test reads, so it gets a test.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

import prior_context as PC  # noqa: E402


def test_block_is_not_empty():
    assert len(PC.build_block()) > 200


def test_measured_cases_come_first():
    block = PC.build_block()
    first_header = next(ln for ln in block.splitlines() if ln.startswith("## "))
    measured = [c for c in PC.load_cases() if c.get("confidence") == "measured-here"]
    assert measured, "expected at least one measured-here access-control case"
    assert measured[0]["title"][:20] in first_header


def test_block_does_not_leak_the_hash_topic():
    """The block is meant to prime access-control judgement, not hand over the crypto answer."""
    block = PC.build_block().lower()
    for word in ("md5", "sha1", "digest", "password_hash", "32 hex"):
        assert word not in block, word


def test_limit_is_respected():
    assert PC.build_block(limit=2).count("## ") == 2


def test_only_access_control_categories():
    cats = {c["category"] for c in PC.load_cases()}
    assert cats <= PC.SAFE_CATEGORIES, cats
