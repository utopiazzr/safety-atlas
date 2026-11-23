"""Enforce the layer rule from ARCHITECTURE.md.

Dependencies may only point downward. A violation here means someone reached across a boundary
and the module can no longer be tested in isolation.
"""
import ast
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

#: module -> layer. Anything not listed is unknown and treated as a failure.
LAYERS = {
    # L0: pure data / pure functions, no local imports
    "delivery_model": 0, "attack_surface": 0, "realistic_ws": 0, "best_carrier": 0,
    "carriers": 0, "llm_attacker": 0, "exposure_engine": 0, "exposure_guarantee": 0,
    "proto_bridge": 0, "target": 0, "__init__": 0, "prior_context": 1,
    "sandbox_shim": 1, "custom_rules2": 0, "external_corpus": 1, "oracle_bandit": 1,
    "sabotage": 0, "cweval": 1, "cweval_run": 3, "cweval_c": 1,
    "shell_object": 0,
    # L1: side effects on one axis (process, network, LLM call)
    "gates": 1, "llm_work": 1, "real_target2": 1, "measure": 1,
    # L2: runs one experiment end to end
    "audit": 2, "poison": 2, "generate_cases": 2,
    # L3: orchestrates several experiments
    "hunt_chain": 3, "adaptive_loop": 3, "adaptive_authz": 3, "preflight": 3,
    # L4: the CLI
    "asl": 4,
}


def _imports(path):
    tree = ast.parse(path.read_text(encoding="utf-8", errors="ignore"))
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                out.add(a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            out.add(node.module.split(".")[0])
    return out


def _modules():
    found = {}
    for p in (ROOT / "engine").glob("*.py"):
        found[p.stem] = p
    for p in ROOT.glob("*.py"):
        found[p.stem] = p
    return found


@pytest.mark.parametrize("name", sorted(_modules()))
def test_module_layering(name):
    path = _modules()[name]
    local = _modules()
    deps = {d for d in _imports(path) if d in local and d != name}

    if name not in LAYERS:
        pytest.fail(f"{name}: not assigned a layer in this test. "
                    f"Decide its layer and add it to ARCHITECTURE.md and LAYERS.")

    layer = LAYERS[name]
    for dep in deps:
        if dep not in LAYERS:
            pytest.fail(f"{name} imports {dep}, which has no declared layer")
        if LAYERS[dep] > layer:
            pytest.fail(
                f"{name} (L{layer}) imports {dep} (L{LAYERS[dep]}): dependencies must "
                f"point downward. Move the shared code into a lower layer."
            )


def test_no_cycles():
    """A cycle makes the layers meaningless."""
    local = _modules()
    graph = {name: {d for d in _imports(p) if d in local and d != name}
             for name, p in local.items()}
    for start in graph:
        stack, seen = [start], set()
        while stack:
            node = stack.pop()
            if node in seen:
                continue
            seen.add(node)
            for nxt in graph.get(node, ()):
                if nxt == start:
                    pytest.fail(f"import cycle involving {start}")
                stack.append(nxt)


@pytest.mark.parametrize("name", ["delivery_model", "attack_surface"])
def test_l0_modules_stay_pure(name):
    """L0 modules may not start processes, open sockets or touch the filesystem.

    Checked on the AST, not the text: a Chinese docstring mentioning a socket is not a socket.
    """
    tree = ast.parse((ROOT / "engine" / f"{name}.py").read_text(encoding="utf-8"))
    banned = {"subprocess", "socket", "urllib", "http", "requests", "shutil"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                assert a.name.split(".")[0] not in banned, (
                    f"{name} is L0 and must stay pure; it imports {a.name}")
        elif isinstance(node, ast.ImportFrom) and node.module:
            assert node.module.split(".")[0] not in banned, (
                f"{name} is L0 and must stay pure; it imports from {node.module}")


@pytest.mark.parametrize("name", ["delivery_model", "attack_surface"])
def test_l0_has_no_file_writes(name):
    """An L0 module must not write files; callers do that."""
    tree = ast.parse((ROOT / "engine" / f"{name}.py").read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            assert node.func.id not in ("open", "remove", "unlink", "rename"), (
                f"{name} is L0 and called {node.func.id}()")
