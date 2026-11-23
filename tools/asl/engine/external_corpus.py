"""Fetch an external corpus at run time instead of vendoring it.

SecurityEval (s2e-lab/SecurityEval) publishes 121 samples as dataset.jsonl with three fields:
ID, Prompt (a signature plus docstring, no security requirement stated), Insecure_code (the known
weak completion). That is the same shape this tool measures, so it is the highest-value import
available.

It has **no license file**, which means all rights reserved. Copying the prompts into this
repository would be a licensing problem, so nothing is vendored: the dataset is fetched on demand,
cached outside the package, checksummed, and every report names the upstream repo and commit.

Repos that *do* carry a permissive license (CWEval is Apache-2.0, RepoGuardBench is MIT) can be
vendored, and a later round can do that.
"""
from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

SOURCES = {
    "seceval": {
        "repo": "s2e-lab/SecurityEval",
        "branch": "main",
        "path": "dataset.jsonl",
        "url": "https://raw.githubusercontent.com/s2e-lab/SecurityEval/main/dataset.jsonl",
        "license": "none published - fetched, never vendored",
        "citation": ("SecurityEval: S. Siddiq et al., 'SecurityEval Dataset: Mining "
                     "Vulnerability-Contributing Code from LLMs', 2022"),
        "fields": {"id": "ID", "prompt": "Prompt", "insecure": "Insecure_code"},
    },
    # Meta PurpleLlama. MIT per CybersecurityBenchmarks/LICENSE, so vendoring would be allowed;
    # fetched anyway so upstream stays canonical.
    "cyberseceval": {
        "repo": "meta-llama/PurpleLlama",
        "branch": "main",
        "path": "CybersecurityBenchmarks/datasets/instruct/instruct.json",
        "url": ("https://raw.githubusercontent.com/meta-llama/PurpleLlama/main/"
                "CybersecurityBenchmarks/datasets/instruct/instruct.json"),
        "license": "MIT (CybersecurityBenchmarks/LICENSE)",
        "citation": "CyberSecEval: Bhatt et al., 'CyberSecEval 2', Meta 2024",
        "fields": {"id": "prompt_id", "prompt": "test_case_prompt",
                   "insecure": "origin_code", "cwe": "cwe_identifier"},
        "json_array": True,
    },
}

CACHE = Path(os.environ.get("ASL_CORPUS_CACHE", "/dev/shm/asl-corpus"))
UA = {"User-Agent": "asl-corpus-fetcher"}


@dataclass
class Sample:
    source: str
    sample_id: str
    prompt: str
    insecure: str
    cwe: str


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(name: str, *, force: bool = False, timeout: int = 90) -> tuple[Path, str, bool]:
    """Download (or reuse) one corpus. Returns (path, sha256, from_cache)."""
    if name not in SOURCES:
        raise KeyError(f"unknown corpus {name!r}; known: {sorted(SOURCES)}")
    spec = SOURCES[name]
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / f"{name}.jsonl"

    if dest.is_file() and not force:
        data = dest.read_bytes()
        if data.strip():
            return dest, _sha256(data), True

    req = urllib.request.Request(spec["url"], headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    if not data.strip():
        raise RuntimeError(f"empty download from {spec['url']}")
    dest.write_bytes(data)
    return dest, _sha256(data), False


def _cwe_of(sample_id: str) -> str:
    import re
    m = re.search(r"CWE-?(\d+)", sample_id, re.I)
    return f"CWE-{int(m.group(1)):03d}" if m else "CWE-000"


def load(name: str = "seceval", *, force: bool = False) -> tuple[list[Sample], dict]:
    """Parse a corpus into Samples plus a provenance record."""
    spec = SOURCES[name]
    path, digest, cached = fetch(name, force=force)
    f = spec["fields"]
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if spec.get("json_array"):
        try:
            rows = json.loads(raw)
        except json.JSONDecodeError:
            rows = []
    else:
        rows = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    out: list[Sample] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        sid = str(row.get(f["id"], ""))
        prompt = str(row.get(f["prompt"], ""))
        insecure = str(row.get(f["insecure"], ""))
        if not sid or not prompt:
            continue
        cwe_field = f.get("cwe")
        cwe = _cwe_of(str(row.get(cwe_field, "")) if cwe_field else sid) \
            if cwe_field else _cwe_of(sid)
        out.append(Sample(source=name, sample_id=sid, prompt=prompt,
                          insecure=insecure, cwe=cwe))
    meta = {"source": name, "repo": spec["repo"], "branch": spec["branch"],
            "url": spec["url"], "license": spec["license"], "citation": spec["citation"],
            "sha256": digest, "cached": cached, "count": len(out),
            "path": str(path)}
    return out, meta


def cwe_counts(samples: list[Sample]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for s in samples:
        counts[s.cwe] = counts.get(s.cwe, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: -kv[1]))
