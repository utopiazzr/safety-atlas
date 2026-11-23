"""The shell-object check must fire on the measured pattern and stay quiet on normal code.

The first version only looked for a constructor directly inside a permission branch. It missed
every real case, because the agent factored the blank object into a one-line helper:

    def _no_access(pid):
        return Project(id=pid, owner_id="", name="")

    def get_project(pid, user_id):
        if user_id != p.owner_id and user_id not in p.members:
            return _no_access(pid)

So both shapes get a test.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))

import shell_object as SO  # noqa: E402


VIOLATING = """
class Project:
    def __init__(self, id, owner_id, name):
        self.id = id

def get_project(pid, user_id, projects):
    p = projects.get(pid)
    if p is None or p.owner_id != user_id:
        return Project(id=pid, owner_id="", name="")
    return p
"""

INDIRECT = """
class Project:
    def __init__(self, id, owner_id, name):
        self.id = id

def _no_access(pid):
    return Project(id=pid, owner_id="", name="")

def get_project(pid, user_id, projects):
    p = projects.get(pid)
    if p is None:
        return _no_access(pid)
    if user_id != p.owner_id and user_id not in p.members:
        return _no_access(pid)
    return p
"""

CLEAN = """
class Project:
    def __init__(self, id, owner_id, name):
        self.id = id

def get_project(pid, user_id, projects):
    p = projects.get(pid)
    if p is None or p.owner_id != user_id:
        return None
    return p
"""

EMPTY_DICT = """
def get_thing(tid, user_id, things):
    t = things.get(tid)
    if t["owner"] != user_id:
        return {}
    return t
"""

UNRELATED = """
class Project:
    def __init__(self, id, owner_id, name):
        self.id = id

def make_default(**kw):
    return Project(id="", owner_id="", name="")
"""


def test_fires_inline():
    hits = SO.scan_source(VIOLATING)
    assert len(hits) == 1, hits
    assert "Project(" in hits[0]["code"]


def test_fires_through_a_helper():
    """The shape the agent actually produced: construction one call away.

    Only the permission branch is reported. The `if p is None:` branch returns the same helper but
    its guard carries no permission term, and "not found" is a legitimate blank.
    """
    hits = SO.scan_source(INDIRECT)
    # both blank returns in a permission-touching function count: the guarded one, and the
    # "not found" fall-through. Both hand the caller an object instead of a refusal.
    assert len(hits) == 2, hits
    assert all("_no_access()" in h["via"] for h in hits), hits


def test_fires_when_denial_falls_through():
    """Positive guard returns the real object; the blank return sits outside the guard."""
    src = """
class Project:
    def __init__(self, id, owner_id, name):
        self.id = id

def _redacted(pid):
    return Project(id=pid, owner_id="", name="")

def get_project(pid, user_id, projects):
    p = projects.get(pid)
    if user_id == p.owner_id or user_id in p.members:
        return p
    return _redacted(pid)
"""
    hits = SO.scan_source(src)
    assert len(hits) == 1, hits
    assert "permission fn" in hits[0]["via"]


def test_quiet_on_return_none():
    assert SO.scan_source(CLEAN) == []


def test_fires_on_empty_dict_in_guard():
    assert len(SO.scan_source(EMPTY_DICT)) == 1


def test_quiet_when_not_guarded():
    """A blank default constructor outside a permission branch is normal code."""
    assert SO.scan_source(UNRELATED) == []
