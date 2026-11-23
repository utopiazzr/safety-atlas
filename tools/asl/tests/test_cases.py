"""The case database must stay well-formed as people add entries."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "cases"))


def test_cases_validate():
    import validate
    assert validate.main() == 0


def test_every_case_explains_why_it_needs_no_attacker():
    data = json.loads((ROOT / "cases" / "cases.json").read_text(encoding="utf-8"))
    for c in data["cases"]:
        assert len(c["why_non_adversarial"]) >= 20, (
            f"{c['id']}: this is the field that makes the database meaningful")
        assert len(c["sources"]) >= 1, f"{c['id']}: no source"
