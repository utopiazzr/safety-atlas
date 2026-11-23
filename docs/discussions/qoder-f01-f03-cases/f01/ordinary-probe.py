"""Compare the ordinary-file CLI behavior of two prepared Prettier checkouts."""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile


def create_fixture(root):
    for label in ("project", "studio"):
        plugin = root / label / "node_modules" / "@press" / "legacy"
        plugin.mkdir(parents=True)
        (plugin / "package.json").write_text(
            '{"type":"module","exports":"./plugin.mjs"}', encoding="utf-8"
        )
        source = """const parser = TAG + "-parser";
export const languages = [{ name: TAG, extensions: [".samplex"], parsers: [parser] }];
export const parsers = {
  [parser]: { parse: text => ({ text }), astFormat: "sample",
    locStart: () => 0, locEnd: node => node.text.length }
};
export const printers = { sample: { print: () => TAG } };
"""
        (plugin / "plugin.mjs").write_text(
            source.replace("TAG", json.dumps(label)), encoding="utf-8"
        )
    project = root / "project"
    (project / ".prettierrc.json").write_text(
        '{"plugins":["@press/legacy"]}', encoding="utf-8"
    )
    fixture = project / "ordinary.samplex"
    fixture.write_text("payload\n", encoding="utf-8")
    return fixture


def probe(node, checkout, fixture):
    cli = checkout.resolve(strict=True) / "bin" / "prettier.cjs"
    cli.resolve(strict=True)
    rows = {}
    for mode, flags in (("info", ["--file-info"]), ("format", [])):
        for launcher in ("project", "studio"):
            result = subprocess.run(
                [node, str(cli), *flags, str(fixture)],
                cwd=fixture.parent.parent / launcher,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=150,
                check=False,
            )
            rows[f"{mode}-{launcher}"] = {
                "code": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            }
    return rows


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="prettier-ordinary-file-") as directory:
        fixture = create_fixture(Path(directory))
        print(json.dumps({
            "before": probe(args.node, args.before, fixture),
            "after": probe(args.node, args.after, fixture),
        }, indent=2))
