"""CWEval's C-language tasks, adapted to the same harness.

Different split rule from Python. The C task file is:

    // BEGIN PROMPT
    /** docstring */
    void f(...) {
        // BEGIN SOLUTION
        <reference body>
    }
    // BEGIN ENTRYPOINT
    int main(...) { ... }        <- the test driver runs the compiled binary

So the spec is: everything before `// BEGIN SOLUTION`, a brace to close the emptied body, then
everything from `// BEGIN ENTRYPOINT` onward. The entrypoint must survive, because the driver
executes the binary rather than importing a module.

Compilation is ours, not the agent's: the driver expects `compiled/<task>_task` and
`compiled/<task>_unsafe` to exist, and we do not want the agent controlling the build.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

REPO = "Co1lin/CWEval"
BRANCH = "main"
LICENSE = "Apache-2.0"
CACHE = Path(os.environ.get("ASL_CORPUS_CACHE", "/dev/shm/asl-corpus")) / "cweval-c"
UA = {"User-Agent": "asl-cweval-c"}
SOLUTION = "// BEGIN SOLUTION"
ENTRY = "// BEGIN ENTRYPOINT"


def _get(url: str, timeout: int = 90, tries: int = 3) -> bytes:
    import time
    import urllib.error
    import urllib.request
    last: Exception | None = None
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA),
                                        timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
        except Exception as e:
            last = e
        time.sleep(2)
    raise last if last else RuntimeError("download failed")


def list_c_tasks(*, refresh: bool = False) -> list[str]:
    CACHE.mkdir(parents=True, exist_ok=True)
    idx = CACHE / "index.json"
    if idx.is_file() and not refresh:
        return json.loads(idx.read_text(encoding="utf-8"))["ids"]
    tree = json.loads(_get(
        f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1").decode())
    paths = [t["path"] for t in tree.get("tree", []) if t["type"] == "blob"]
    groups: dict[str, dict[str, str]] = {}
    for p in paths:
        m = re.match(r"benchmark/lang/c/(cwe_\d+_\d+_c)_(task\.c|test\.py|unsafe\.c)$", p)
        if m:
            groups.setdefault(m.group(1), {})[m.group(2)] = p
    ids = sorted(k for k, v in groups.items() if len(v) == 3)
    idx.write_text(json.dumps({"ids": ids, "files": groups, "repo": REPO,
                               "branch": BRANCH, "license": LICENSE},
                              ensure_ascii=False, indent=2), encoding="utf-8")
    return ids


def fetch_c_task(task_name: str, *, refresh: bool = False) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    meta = CACHE / f"{task_name}.json"
    if meta.is_file() and not refresh:
        return json.loads(meta.read_text(encoding="utf-8"))

    base = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/benchmark/lang/c"
    task_src = _get(f"{base}/{task_name}_task.c").decode("utf-8", "ignore")
    test_src = _get(f"{base}/{task_name}_test.py").decode("utf-8", "ignore")
    unsafe_src = _get(f"{base}/{task_name}_unsafe.c").decode("utf-8", "ignore")

    if SOLUTION in task_src and ENTRY in task_src:
        head, rest = task_src.split(SOLUTION, 1)
        _, tail = rest.split(ENTRY, 1)
        spec = head.rstrip("\n") + "\n}\n\n" + ENTRY + tail
    else:
        spec = task_src

    out = {
        "task_name": task_name,
        "cwe": "CWE-" + task_name.split("_")[1],
        "spec": spec,
        "reference": task_src,
        "test": test_src,
        "unsafe": unsafe_src,
        "sha256": hashlib.sha256((task_src + test_src + unsafe_src).encode()).hexdigest(),
        "repo": REPO, "branch": BRANCH, "license": LICENSE,
        "source": f"https://github.com/{REPO}/blob/{BRANCH}/benchmark/lang/c/{task_name}_task.c",
    }
    meta.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


@dataclass
class BuildResult:
    ok: bool
    returncode: int
    stderr: str


def _compile(src: Path, out_bin: Path, timeout: int = 120) -> BuildResult:
    env = {**os.environ, "TMPDIR": "/dev/shm/work"}
    r = subprocess.run(["gcc", "-w", "-o", str(out_bin), str(src)],
                       capture_output=True, text=True, timeout=timeout, env=env)
    return BuildResult(r.returncode == 0, r.returncode, (r.stderr or "")[-300:])


def materialise(task: dict, workspace: Path) -> Path:
    """Write spec + test, and build the unsafe baseline the driver needs."""
    workspace.mkdir(parents=True, exist_ok=True)
    impl = workspace / f"{task['task_name']}_task.c"
    impl.write_text(task["spec"], encoding="utf-8")
    (workspace / f"{task['task_name']}_test.py").write_text(task["test"], encoding="utf-8")
    unsafe = workspace / f"{task['task_name']}_unsafe.c"
    unsafe.write_text(task["unsafe"], encoding="utf-8")
    (workspace / "compiled").mkdir(exist_ok=True)
    (workspace / "README.md").write_text(
        f"# task\n\nImplement `{task['task_name']}_task.c`. "
        f"`{task['task_name']}_test.py` is the acceptance suite; do not modify it.\n",
        encoding="utf-8")
    _compile(unsafe, workspace / "compiled" / f"{task['task_name']}_unsafe")
    return impl


def compile_task(workspace: Path, task_name: str) -> BuildResult:
    src = workspace / f"{task_name}_task.c"
    out = workspace / "compiled" / f"{task_name}_task"
    return _compile(src, out)


def run_pytest(workspace: Path, task_name: str, marker: str, timeout: int = 300) -> dict:
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "TMPDIR": "/dev/shm/work"}
    r = subprocess.run([sys.executable, "-m", "pytest", f"{task_name}_test.py", "-m", marker,
                        "-q", "--no-header", "-p", "no:cacheprovider"],
                       cwd=str(workspace), capture_output=True, text=True, timeout=timeout,
                       env=env)
    lines = (r.stdout or "").strip().splitlines()
    return {"passed": r.returncode == 0, "rc": r.returncode,
            "summary": lines[-1][:80] if lines else ""}


def self_check(task: dict) -> dict:
    """Reference must build and pass both suites; an empty body must fail the security suite."""
    root = Path("/dev/shm/cweval-c-check") / task["task_name"]
    shutil.rmtree(root, ignore_errors=True)
    try:
        ws = root / "reference"
        impl = materialise(task, ws)
        impl.write_text(task["reference"], encoding="utf-8")
        b = compile_task(ws, task["task_name"])
        if not b.ok:
            return {"task_name": task["task_name"], "cwe": task["cwe"], "valid": False,
                    "error": f"reference build failed: {b.stderr[-120:]}"}
        fn = run_pytest(ws, task["task_name"], "functionality")
        sec = run_pytest(ws, task["task_name"], "security")

        ws2 = root / "stub"
        materialise(task, ws2)
        b2 = compile_task(ws2, task["task_name"])
        stub_sec = (run_pytest(ws2, task["task_name"], "security")
                    if b2.ok else {"passed": None, "summary": "stub build failed"})
        return {"task_name": task["task_name"], "cwe": task["cwe"],
                "valid": fn["passed"] and sec["passed"],
                "reference": {"functionality": fn["passed"], "security": sec["passed"]},
                "stub_builds": b2.ok,
                "stub_security_passed": stub_sec["passed"],
                "stub_summary": stub_sec["summary"]}
    finally:
        shutil.rmtree(root, ignore_errors=True)
