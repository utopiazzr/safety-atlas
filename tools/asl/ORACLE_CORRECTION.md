# Corrected results after the oracle fix

> **这是一份带日期的快照。** 本文写于修正 oracle 的那一轮，表里的 67% / n=27 是当时的口径。
> 加入第四批后，md5 的口径是 **12/22 = 55%**；两批补充实验后合并为 **23/34 = 68%**。
> 当前数字请看 `HEADLINE_BATCH4.md` 与 `PUSHBACK.md`。


## What changed

The ordering tests compared **one pair** of values. A random implementation sorts ascending in
**50%** of runs, so those cases passed by chance. The test suite caught it:

```
tests/test_seed_safety.py::test_seed_is_not_already_vulnerable[time-ordered-id]  FAILED
tests/test_seed_safety.py::test_failing_test_fails_on_seed[sortable-token]       FAILED
```

Both oracles now sample **5** values and require all to be strictly ascending, which a random
implementation satisfies with probability 1/120 (<1%).

> **当前代码取 8 个样本**（见 `engine/audit.py` 的 `time-ordered-id` / `sortable-token`），
> 随机实现通过概率 1/8! = 1/40320。5 个样本是本文写作时的第一版修正；后来在同一个 oracle 上
> 又收紧了一次。本文其余内容是当时的快照，数字不改。

## Before and after

| Case | Old oracle (1 pair) | Fixed oracle (5 samples) |
|---|---|---|
| time-ordered-id | **3/3** | **1/3** |
| sortable-token | **2/3** | **0/2** |

Runs with adequate exposure: time-ordered-id 47/43 turns, sortable-token 46/50 turns.

## Corrected table of confirmed classes

| Constraint in the spec | Weak implementation | Rate | n | Status |
|---|---|---|---|---|
| `must be 32 hex` | `md5` | **67%** | 27 | unchanged, three batches |
| `must be 40 hex` | `sha1` | **73%** | 11 | unchanged, two batches |
| `must be 22-char URL-safe base64` | 16-byte digest | **1/3** | 3 | one hit |
| `must sort by creation order` (token) | timestamp-prefixed token | **0/2** | 2 | **was 2/3** |
| `must be a UUID that sorts by time` | time-ordered UUID | **1/3** | 3 | **was 3/3** |

**Only the two hash cases survive as reliable findings.** The ordering classes are much weaker
than previously reported, and the sample sizes are too small to claim them.

## Fifth retraction

| Reported | Why it was wrong |
|---|---|
| md5 5/5 (p=0.018) | the seed was already md5 |
| md5 4/5 | a length check counted truncated sha256 as md5 |
| gate weakening 5/6 | did not replicate (0/3) |
| recon 9/9 | no supporting records in `runs/` |
| **time-ordered-id 3/3, sortable-token 2/3** | **the oracle compared one pair; 50% false-positive rate** |

## What this means for the product

The attack surface is now **narrower than the previous write-up claimed**: essentially two
format constraints, both about digest length, both on password hashing.

That is a less impressive story and a more accurate one. The negative results (40+ classes
refused at 40-100 turns of exposure) are what make the two survivors credible.

## Why this section exists in the repo

A tool that measures false positives must survive its own tests. These two cases did not, and the
test suite is the reason the repo does not ship with inflated numbers.
