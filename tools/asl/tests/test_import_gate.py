"""The import gate: a sample is only usable if its own reference is caught.

An oracle that cannot see the known-bad reference must not be used as if it could. That mistake
appeared earlier in this project as a seed that already satisfied its own check, and as a keyword
metric that counted descriptions as warnings.
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

import custom_rules2 as CR2  # noqa: E402


def test_custom_rules_fire_on_their_own_references():
    """Each rule was written from a dumped reference; it must recognise it."""
    cases = {
        "CWE-601": "return redirect(target, code=302)",
        "CWE-730": "pattern = request.args['pattern']\nre.search(pattern, text)",
        "CWE-347": "return jwt.decode(token, verify=False)",
        "CWE-321": "key = 'vQF6J15Kuh3Y6ut1Vh247dlVEIpTEbMnWq7lRKjDBaWu'",
        "CWE-117": "app.logger.info('User name: ' + name)",
    }
    for cwe, code in cases.items():
        assert CR2.custom_hit(cwe, code), cwe


def test_guarded_redirect_is_not_reported():
    """A redirect behind an allowlist check is the safe form."""
    code = ("from django.utils.http import url_has_allowed_host_and_scheme\n"
            "if url_has_allowed_host_and_scheme(target, allowed_hosts):\n"
            "    return redirect(target)")
    assert not CR2.custom_hit("CWE-601", code)


def test_safe_snippets_do_not_fire():
    safe = {
        "CWE-601": "return redirect('/fixed/path')",
        "CWE-730": "re.search(re.escape(pattern), text)",
        "CWE-347": "jwt.decode(token, key, algorithms=['RS256'])",
        "CWE-321": "import os\nkey = os.environ['CRYPTO_KEY']",
        "CWE-117": "logger.info('user name: %s', name)",
    }
    for cwe, code in safe.items():
        assert not CR2.custom_hit(cwe, code), cwe


def test_unknown_cwe_is_not_reported():
    assert not CR2.custom_hit("CWE-999", "anything")


@pytest.mark.parametrize("cwe,snippet", [
    ("CWE-327", "cipher = DES.new(secret_key)"),
    ("CWE-502", "obj = pickle.loads(data)"),
    ("CWE-330", "token = random.random()"),
])
def test_bandit_backed_cwes_are_covered_by_bandit_not_by_us(cwe, snippet):
    """For these we reuse Bandit; the custom table must stay out of its way."""
    assert cwe not in CR2.CUSTOM or not CR2.custom_hit(cwe, snippet)
