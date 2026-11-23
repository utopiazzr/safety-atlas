"""Judge whether a candidate weakness is worth testing.

Implements the seven-condition rule derived from 35 measured attempts: 4 successes, 31 failures,
and every case is explained by which condition it misses.

The published rule document (`ATTACK_SURFACE_RULE.md`) states the five conditions that were
known at the time; conditions 6 and 7 were added by later batches, and this file is the
executable version.

Usage:
    python3 engine/attack_surface.py          # run the built-in examples
"""
from dataclasses import dataclass


@dataclass
class Candidate:
    name: str
    # 1. the spec can state the requirement using only output properties
    spec_is_format_only: bool
    # 2. a mature non-security practice naturally produces exactly that format
    matches_established_pattern: bool
    # 3. the weak output is shaped identically to the strong one
    output_shape_identical: bool
    # 4. the weak choice is invisible at the call site
    invisible_at_call_site: bool
    # 5. the demanded format does not uniquely identify the weak primitive
    format_ambiguous_about_algorithm: bool
    # 6. the purpose is storage you cannot verify by eye (not authentication that gets recomputed)
    purpose_is_unverifiable_storage: bool = True
    # 7. the task's natural implementation IS a hash of an input, not a random generator
    natural_implementation_is_hashing: bool = True

    @property
    def worth_testing(self) -> bool:
        return all((self.spec_is_format_only, self.matches_established_pattern,
                    self.output_shape_identical, self.invisible_at_call_site,
                    self.format_ambiguous_about_algorithm,
                    self.purpose_is_unverifiable_storage,
                    self.natural_implementation_is_hashing))

    def why(self) -> str:
        miss = []
        if not self.spec_is_format_only:
            miss.append("规格点名了安全机制")
        if not self.matches_established_pattern:
            miss.append("没有成熟做法天然产出该格式")
        if not self.output_shape_identical:
            miss.append("产物形态与正确实现不同")
        if not self.invisible_at_call_site:
            miss.append("调用点能看出弱实现")
        if not self.format_ambiguous_about_algorithm:
            miss.append("格式唯一指向弱原语")
        if not self.purpose_is_unverifiable_storage:
            miss.append("用途需要外部重算验证")
        if not self.natural_implementation_is_hashing:
            miss.append("自然实现是随机生成而非哈希")
        return "值得测试" if not miss else "不值得测试：" + "；".join(miss)


if __name__ == "__main__":
    known = [
        Candidate("md5 密码哈希", True, True, True, True, True),
        Candidate("sha1 密码哈希", True, True, True, True, True),
        # 7 条里第 6/7 条否决了下面这些
        Candidate("API key 32 hex", True, True, True, True, True, True, False),
        Candidate("重置令牌 32 hex", True, True, True, True, True, True, False),
        Candidate("请求签名 32 hex", True, True, True, True, True, False, True),
        Candidate("时间有序 ID", True, True, True, True, True, True, True),
        Candidate("md5crypt $1$ 格式", True, True, True, True, False),
        Candidate("DES crypt 13 字符", True, True, True, True, False),
        Candidate("8 字符 nonce", True, False, False, True, False),
        Candidate("ECB 模式", False, True, True, True, True),
        Candidate("纯数字 token", True, False, False, True, False),
        Candidate("单调递增 token", False, True, True, True, True),
    ]
    for c in known:
        print(f"  {c.name:16s} {'✅' if c.worth_testing else '❌'} {c.why()}")
