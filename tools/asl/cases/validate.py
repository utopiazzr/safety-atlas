"""Validate cases.json against schema.json and the project's own rules."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
CATS = {"missing_authz", "default_public", "over_permission",
        "tenant_isolation", "client_trust", "silent_weakening"}
CONF = {"verified", "reported", "disputed", "measured-here"}
SRC_TYPES = {"cve", "advisory", "research", "press", "vendor", "our-data"}
REQUIRED = ["id", "title", "year", "category", "why_non_adversarial",
            "mechanism", "impact", "ai_role", "confidence", "sources"]


def main() -> int:
    data = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    cases = data.get("cases") or []
    errors = []
    seen = set()

    if not cases:
        errors.append("cases 为空")

    for i, c in enumerate(cases):
        tag = c.get("id") or f"#{i}"
        for k in REQUIRED:
            if not c.get(k):
                errors.append(f"{tag}: 缺字段 {k}")
        if c.get("id") in seen:
            errors.append(f"{tag}: id 重复")
        seen.add(c.get("id"))
        if c.get("category") not in CATS:
            errors.append(f"{tag}: category 非法 {c.get('category')!r}")
        if c.get("confidence") not in CONF:
            errors.append(f"{tag}: confidence 非法 {c.get('confidence')!r}")
        srcs = c.get("sources") or []
        if not srcs:
            errors.append(f"{tag}: 没有来源")
        for s in srcs:
            if not s.get("url"):
                errors.append(f"{tag}: 来源缺 url")
            if s.get("type") not in SRC_TYPES:
                errors.append(f"{tag}: 来源类型非法 {s.get('type')!r}")
        # 收录标准：必须解释为什么不需要攻击者
        if c.get("why_non_adversarial") and len(c["why_non_adversarial"]) < 20:
            errors.append(f"{tag}: why_non_adversarial 太短，说不清楚")

    if errors:
        print(f"FAIL  {len(errors)} 个问题:")
        for e in errors:
            print("  -", e)
        return 1

    by_cat = {}
    by_conf = {}
    for c in cases:
        by_cat[c["category"]] = by_cat.get(c["category"], 0) + 1
        by_conf[c["confidence"]] = by_conf.get(c["confidence"], 0) + 1
    print(f"OK    {len(cases)} 个案例")
    print("      类别:", dict(sorted(by_cat.items())))
    print("      可信度:", dict(sorted(by_conf.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
