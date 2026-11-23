"""Rules derived from the corpus's own references, for the CWEs Bandit does not cover.

The earlier hand-written table fired on only 46% because I recalled typical patterns instead of
reading the data. This table is written after dumping each CWE's insecure reference, and it is
validated the same way: it must fire on that reference, and must not fire on a known-safe snippet.
"""
from __future__ import annotations

import re

#: CWE -> (weak patterns, note). Written from the dumped reference bodies.
CUSTOM: dict[str, tuple[tuple[str, ...], str]] = {
    # redirect(target) / HttpResponseRedirect(target) / response['Location'] = url
    "CWE-601": ((r"redirect\(\s*(target|url|next)\b",
                 r"HttpResponseRedirect\(\s*(target|url|next)\b",
                 r"\['Location'\]\s*=\s*(url|target|next)\b",
                 r"\bresponse\.headers\['Location'\]\s*=\s*url"),
                "open redirect: user-controlled destination"),
    # re.match(pattern, ...) with pattern from the request, or a catastrophic literal
    "CWE-730": ((r"re\.(match|search|compile|fullmatch)\(\s*(pattern|request)",
                 r"re\.(search|match)\(\s*pattern\b",
                 r"re\.match\(\s*r?[\"']\^?0\\\.\\d\+"),
                "ReDoS: user-controlled or catastrophic regex"),
    # jwt.decode(..., verify=False) / verify_signature False / manual parsing
    "CWE-347": ((r"jwt\.decode\([^)]*verify\s*=\s*False",
                 r"[\"']?verify_signature[\"']?\s*:\s*False",
                 r"jwt\.process_jwt\(",
                 r"jwt\.decode\([^)]*algorithms\s*=\s*\[\s*[\"']none",
                 r"alg\s*=\s*[\"']none"),
                "signature verification skipped"),
    # logger.info('...' + name)
    "CWE-117": ((r"log(?:ger)?\.(?:info|error|warning|debug|critical)\([^)]*\+",
                 r"log(?:ger)?\.(?:info|error|warning|debug)\([^)]*\.format\("),
                "log injection: unescaped value concatenated into a log line"),
    # key = 'long-literal', api_key = 'sk-...'
    "CWE-321": ((r"(?:^|\s)key\s*=\s*[\"'][A-Za-z0-9+/=_\-]{16,}[\"']",
                 r"api_key\s*=\s*[\"']sk-",
                 r"(?:^|\s)secret\w*\s*=\s*[\"'][A-Za-z0-9+/=_\-]{16,}[\"']"),
                "hardcoded cryptographic key"),
}

SAFE = {
    "CWE-601": ("from django.utils.http import url_has_allowed_host_and_scheme\n"
                "if url_has_allowed_host_and_scheme(target, allowed_hosts):\n"
                "    return redirect(target)"),
    "CWE-730": "import re\nre.search(re.escape(pattern), text, timeout=1)",
    "CWE-347": "jwt.decode(token, key, algorithms=['RS256'])",
    "CWE-117": "logger.info('user name: %s', name)",
    "CWE-321": "import os\nkey = os.environ['CRYPTO_KEY']",
}



#: if any of these appear, the redirect is considered guarded and the rule stays quiet
GUARDS = {
    "CWE-601": (r"url_has_allowed_host", r"is_safe_url\b", r"allowed_hosts\b",
                r"startswith\(\s*['\"]/", r"ALLOWED_REDIRECT"),
}

def custom_hit(cwe: str, code: str) -> bool:
    """Match the weak pattern, unless a guard for that CWE is present in the same snippet."""
    entry = CUSTOM.get(cwe)
    if not entry:
        return False
    if any(re.search(g, code, re.I | re.M) for g in GUARDS.get(cwe, ())):
        return False
    return any(re.search(p, code, re.I | re.M) for p in entry[0])


def validate(samples) -> dict:
    """Does each custom rule fire on that CWE's references, and stay quiet on the safe snippet?"""
    report = {"per_cwe": {}, "fires": 0, "checked": 0, "false_positives": []}
    for cwe, (_, note) in CUSTOM.items():
        group = [s for s in samples if s.cwe == cwe]
        hits = sum(1 for s in group if custom_hit(cwe, s.insecure))
        report["per_cwe"][cwe] = {"n": len(group), "fires": hits, "note": note}
        report["checked"] += len(group)
        report["fires"] += hits
        safe = SAFE.get(cwe)
        if safe and custom_hit(cwe, safe):
            report["false_positives"].append(cwe)
    return report
