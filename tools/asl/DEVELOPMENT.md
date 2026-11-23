# 开发

## 环境

```sh
cd tools/asl
python3 -m pip install pytest      # 唯一的开发依赖
make test                          # ~45 秒
```

运行时不依赖任何第三方包。**这条不要破**——没有依赖是它能在任何环境跑起来的原因。

## 目录

```
asl.py            CLI，只有参数解析、打印、退出码
engine/           见 ARCHITECTURE.md 的分层
tests/            159 个测试，四个类别见下
runs/             原始数据。每个对外数字都要能在这里找到
*.md              结论与判据，见下面的「读什么」
```

## 四类测试

| 测试 | 查什么 | 为什么重要 |
|---|---|---|
| `test_seed_safety.py` | 种子本身不能中招；测试必须在种子上失败 | 否则测的是空气 |
| `test_oracle_determinism.py` | 同一安全种子跑 20 次判定不能变 | 曾经因此把结果算高一倍 |
| `test_architecture.py` | 依赖不能向上、不能成环；`delivery_model`/`attack_surface` 保持纯 | 否则模块没法独立测试 |
| `test_ci_gate.py` / `test_silent_failure.py` | 门禁语义、失败必须喊 | 静默失败比错误危险 |

## 改代码的流程

1. **先看 `ARCHITECTURE.md`**，确认改动在哪一层
2. 改
3. `make test`
4. 如果改了判定逻辑，加一个能复现旧行为错误的测试
5. PR 里贴 `make test` 输出

## 加一个弱点用例

`engine/audit.py` 的 `CASES` 里加一项，然后：

```sh
make cases        # 种子安全 + oracle 确定性
```

**加之前先过七条件**（`engine/attack_surface.py` 是执行器）：

```sh
python3 engine/attack_surface.py
```

大概率会告诉你「不必试了」。约 60 类已经试过并失败，清单在 `FINAL_BOUNDARY.md`。

## 改一个结论

结论不是改文字，是改数据。流程：

1. `python3 asl.py audit --n 6 --jobs 4`
2. 至少跑两批独立运行
3. 算 Wilson 区间（工具自动算）
4. 原始数据进 `runs/`
5. 改对应的 `.md`

**只改 md 不改数据的 PR 会被拒。** 我们已经撤回过 7 次结论，每次都是因为跳过了这几步。

## 提交规范

```
<层或目录>: <做了什么>

<为什么>

<怎么验证的>
```

例：

```
engine/audit: 排序用例的 oracle 改取 8 个样本

只比一对随机值时有 50% 概率误判为有弱点，把 time-ordered-id 抬到了 3/3。
改后要求 8 个值全部严格递增，随机实现通过概率 1/40320。

make cases 通过；重测 1/3。
```

## 不要做的事

- 不要加第三方运行时依赖
- 不要在 L0 的**纯函数**模块（`delivery_model`、`attack_surface`、`best_carrier`、
  `carriers`、`proto_bridge`）里做 I/O；L0 的构造器模块（`realistic_ws`、`target`、
  `exposure_engine`、`exposure_guarantee`、`llm_attacker`）只做外部交互，不判定结果
- 不要改 `runs/` 里的历史数据（它们是证据）
- 不要把单次运行的结论写进文档
