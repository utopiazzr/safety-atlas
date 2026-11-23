"""Import CWEval (Apache-2.0) as runnable cases, with the oracle validated before use.

Layout, confirmed by reading the repo:
  benchmark/core/py/cwe_078_0_task.py   function signature + docstring, then `# BEGIN SOLUTION`
                                        followed by a reference solution
  benchmark/core/py/cwe_078_0_test.py   imports the function from the task module, embeds an
                                        `_unsafe` and a `_safe` implementation, and runs the
                                        candidate against two param sets:
                                        pytest.mark.functionality and pytest.mark.security

So the security oracle is upstream's own: `pytest -m security` fails if the candidate is the
unsafe shape. No judgment logic to write, which is why this import is worth more than a bigger but
unjudgeable corpus.

Nothing is vendored: Apache-2.0 permits it, but fetching keeps upstream canonical. The cache is
checksummed and every report names the repo.
"""
from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO = "Co1lin/CWEval"
BRANCH = "main"
LICENSE = "Apache-2.0"
CACHE = Path(os.environ.get("ASL_CORPUS_CACHE", "/dev/shm/asl-corpus")) / "cweval"
UA = {"User-Agent": "asl-cweval"}
SOLUTION_MARK = "# BEGIN SOLUTION"
FETCH_RETRIES = 2          # extra attempts after the first one, for a 404 only
FETCH_RETRY_SLEEP = 2.0    # seconds between those attempts


def _get(url: str, timeout: int = 60) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def _get_or_none(url: str, timeout: int = 60) -> bytes | None:
    """GET `url`, retrying a 404 up to FETCH_RETRIES times, then give up and return None.

    raw.githubusercontent.com answers a spurious 404 now and then for a path that really
    exists, so one 404 is not evidence that the task is absent. Every other error still
    raises exactly as `_get` does: only the 404 case is turned into a value.
    """
    attempt = 0
    while True:
        try:
            return _get(url, timeout=timeout)
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                raise
            if attempt >= FETCH_RETRIES:
                return None
            attempt += 1
            time.sleep(FETCH_RETRY_SLEEP)


def list_py_tasks(*, refresh: bool = False) -> list[str]:
    """Return the task ids ('cwe_078_0') that have both a task and a test file."""
    CACHE.mkdir(parents=True, exist_ok=True)
    index = CACHE / "index.json"
    if index.is_file() and not refresh:
        cached = json.loads(index.read_text(encoding="utf-8"))
        # the index is stored as a record; the contract here is the id list, which is what
        # the fresh path returns too, so a cache hit must not hand back the wrapper dict
        return cached["ids"] if isinstance(cached, dict) else cached

    tree = json.loads(_get(
        f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1").decode())
    paths = [t["path"] for t in tree.get("tree", []) if t["type"] == "blob"]
    groups: dict[str, dict[str, str]] = {}
    for p in paths:
        m = re.match(r"benchmark/core/py/(cwe_\d+_\d+)_(task|test)\.py$", p)
        if m:
            groups.setdefault(m.group(1), {})[m.group(2)] = p
    ids = sorted(k for k, v in groups.items() if len(v) == 2)
    index.write_text(json.dumps({"ids": ids, "files": groups, "repo": REPO,
                                 "branch": BRANCH, "license": LICENSE},
                                ensure_ascii=False, indent=2), encoding="utf-8")
    return ids


def fetch_task(task_id: str, *, refresh: bool = False) -> dict:
    """Download a task's two files, cache them, and split the task at the solution marker.

    A cache hit wins over the network. A 404 that survives FETCH_RETRIES is reported as
    `{"task_id": ..., "error": "404"}` (never cached) so one absent file cannot abort a
    batch; callers should test `"error" in task` before touching task["spec"].
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    meta_path = CACHE / f"{task_id}.json"
    if meta_path.is_file() and not refresh:
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass  # truncated/partial cache entry: fall through and refetch it

    base = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/benchmark/core/py"
    task_raw = _get_or_none(f"{base}/{task_id}_task.py")
    test_raw = _get_or_none(f"{base}/{task_id}_test.py")
    if task_raw is None or test_raw is None:
        return {"task_id": task_id, "error": "404"}

    task_src = task_raw.decode("utf-8", "ignore")
    test_src = test_raw.decode("utf-8", "ignore")

    if SOLUTION_MARK in task_src:
        spec, solution = task_src.split(SOLUTION_MARK, 1)
        solution = solution.rstrip("\n")
    else:
        spec, solution = task_src, ""

    out = {
        "task_id": task_id,
        "cwe": "CWE-" + task_id.split("_")[1],
        "spec": spec.rstrip("\n") + "\n",
        "reference_solution": solution,
        "test": test_src,
        "has_solution": bool(solution),
        "sha256": hashlib.sha256((task_src + test_src).encode()).hexdigest(),
        "repo": REPO, "branch": BRANCH, "license": LICENSE,
        "source": f"https://github.com/{REPO}/blob/{BRANCH}/benchmark/core/py/{task_id}_task.py",
    }
    meta_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def materialise(task: dict, workspace: Path) -> Path:
    """Write the spec plus the test into a workspace. Returns the file the agent must edit."""
    workspace.mkdir(parents=True, exist_ok=True)
    impl = workspace / f"{task['task_id']}_task.py"
    impl.write_text(task["spec"], encoding="utf-8")
    (workspace / f"{task['task_id']}_test.py").write_text(task["test"], encoding="utf-8")
    (workspace / "README.md").write_text(
        "# task\n\nImplement the function in "
        f"`{task['task_id']}_task.py`. Do not modify the test file.\n", encoding="utf-8")
    return impl


def run_pytest(workspace: Path, task_id: str, marker: str, timeout: int = 300) -> dict:
    """Run upstream's own marker selection. Exit 0 means the suite passed."""
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "TMPDIR": "/dev/shm/work"}
    r = subprocess.run([sys.executable, "-m", "pytest", f"{task_id}_test.py", "-m", marker,
                        "-q", "--no-header", "-p", "no:cacheprovider"],
                       cwd=str(workspace), capture_output=True, text=True, timeout=timeout,
                       env=env)
    tail = (r.stdout or "").strip().splitlines()
    return {"rc": r.returncode, "passed": r.returncode == 0,
            "summary": tail[-1][:80] if tail else "", "marker": marker}


def self_check(task: dict) -> dict:
    """Both directions must hold before this task is measurable:

      reference solution  -> functionality passes, security passes
      upstream _unsafe    -> at least one security test fails
    """
    root = Path("/dev/shm/cweval-check") / task["task_id"]
    shutil.rmtree(root, ignore_errors=True)

    # direction 1: the spec's own reference solution should satisfy both suites
    ws = root / "reference"
    impl = materialise(task, ws)
    if task["has_solution"]:
        impl.write_text(task["spec"] + task["reference_solution"] + "\n", encoding="utf-8")
        fn = run_pytest(ws, task["task_id"], "functionality", timeout=300)
        sec = run_pytest(ws, task["task_id"], "security", timeout=300)
        ref = {"functionality": fn["passed"], "security": sec["passed"]}
    else:
        ref = {"functionality": None, "security": None}

    # direction 2: an empty body must not silently pass the security suite
    ws2 = root / "stub"
    materialise(task, ws2)
    stub_sec = run_pytest(ws2, task["task_id"], "security", timeout=300)

    shutil.rmtree(root, ignore_errors=True)
    return {"task_id": task["task_id"], "cwe": task["cwe"],
            "reference": ref, "stub_security_passed": stub_sec["passed"],
            "stub_summary": stub_sec["summary"],
            "valid": bool(ref.get("functionality")) and bool(ref.get("security"))}

def _function_name(spec: str) -> str:
    m = re.search(r"^\s*def\s+([A-Za-z_]\w*)\s*\(", spec, re.M)
    return m.group(1) if m else ""


def mutate_names(task: dict, suffix: str = "_v2") -> dict:
    """Return a copy of the task with the function renamed in the spec and in the test."""
    name = _function_name(task["spec"])
    if not name:
        return task
    new = name + suffix
    pat = re.compile(rf"\b{re.escape(name)}\b")
    out = dict(task)
    out["spec"] = pat.sub(new, task["spec"])
    out["test"] = pat.sub(new, task["test"])
    out["reference_solution"] = pat.sub(new, task.get("reference_solution", ""))
    out["mutated_from"] = name
    out["mutated_to"] = new
    return out

def strip_docstring(task: dict) -> dict:
    """Remove the leading docstring from the spec, leaving the signature and any comments."""
    spec = task["spec"]
    try:
        tree = ast.parse(spec)
    except SyntaxError:
        return task
    lines = spec.splitlines(keepends=True)
    drop: set[int] = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(
                    body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
                for ln in range(body[0].lineno, body[0].end_lineno + 1):
                    drop.add(ln)
    if not drop:
        return task
    kept = [ln for i, ln in enumerate(lines, 1) if i not in drop]
    out = dict(task)
    out["spec"] = "".join(kept)
    out["docstring_stripped"] = len(drop)
    return out

def strip_unsafe_example(task: dict) -> dict:
    """Neutralise the `*_unsafe` helper and stop its tests being collected, without deleting lines."""
    src = task["test"]
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return task
    lines = src.splitlines(keepends=True)
    changed = 0
    names: list[str] = []

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if "unsafe" not in node.name.lower():
            continue
        names.append(node.name)
        def_line = node.lineno - 1
        if node.name.startswith("test"):
            # pytest only collects names starting with test_, so this hides it
            lines[def_line] = lines[def_line].replace(node.name, "_skipped_" + node.name, 1)
            changed += 1
        else:
            # blank the helper body: keep the def line, replace the rest with a raise
            body_start = node.body[0].lineno - 1
            body_end = node.end_lineno
            indent = " " * (node.col_offset + 4)
            for i in range(body_start, body_end):
                lines[i] = ""
            lines[body_start] = f"{indent}raise NotImplementedError('removed for the control')\n"
            changed += 1

    if not changed:
        return task
    out = dict(task)
    out["test"] = "".join(lines)
    out["unsafe_neutralised"] = names
    return out
