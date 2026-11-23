# 架构

## 一句话

**测量工具，不是扫描器。** 一个用例（case）是一次受控实验；所有数字都来自多次重复运行。

## 分层

依赖只能**向下**，不能向上。同层依赖测试**不拦**，但现有只有两处是刻意的（见「强制」）。

```
L4  asl.py                     CLI：解析参数、选命令、打印、返回退出码
     │
L3  hunt_chain                 完整攻击链编排（载体→门禁→载荷→判定）
    adaptive_loop              多轮自适应：读模型的回应，再换载体
     │
L2  audit  poison              一次实验的执行器（各自只管自己的用例与报告）
    generate_cases             用例生成（机械校验通过才保留）
     │
L1  measure                    一个可判定单元：造工作区、工作区外跑 oracle、四态判定
    gates                      质量门禁（延长会话的手段）
    llm_work                   用 LLM 设计待办任务
    real_target2               真实模型驱动：起服务、转发、观测
     │
L0  不依赖任何 engine 模块。分两类，区别在「有没有副作用」，不在层次高低：
    纯函数          delivery_model     判定规则（CONFIRMED / NOT_EXECUTED / UNDER_EXPOSED）
                    attack_surface     七条件判据检查器
                    best_carrier       载体长度选择
                    carriers           载体文本（RepoGuardBench 复用；当前无调用方）
                    proto_bridge       协议桥
    构造器          realistic_ws       工作区构造（写文件、git init）
                    target             目标解析（读环境变量、建目录、探版本）
                    exposure_engine    暴露计划（写工作单元、跑 preflight）
                    exposure_guarantee 重试到可用（写 JSON 产物）
                    llm_attacker       LLM 客户端（唯一的网络出口）
```

## 每层的职责

| 层 | 可以做什么 | 不可以做什么 |
|---|---|---|
| L0 | 纯函数与数据结构；或只做一类外部交互的构造器 | 调用模型、发起实验、判定结果 |
| L1 | 起服务、装门禁、调用 LLM、构造并判定**一个**单元 | 决定退出码、写报告 |
| L2 | 跑一次完整实验、汇总多次单元、产出结果 | 决定退出码、打印给人看 |
| L3 | 编排多个实验 | 定义单个实验怎么做 |
| L4 | I/O、参数、退出码 | 实现实验细节 |

## 强制

`tests/test_architecture.py` 解析所有 import，实际强制的是三条：

1. **不能向上**：L(n) 不许 import L(>n) 的模块
2. **不能成环**
3. `delivery_model`、`attack_surface` 保持纯：不 import `subprocess`/`socket`/`urllib`/`http`/
   `requests`/`shutil`，也不调用 `open()`/`remove()`/`unlink()`/`rename()`。
   对应 `test_l0_modules_stay_pure` 与 `test_l0_has_no_file_writes`。
   L0 里其余模块是「构造器」，允许写文件或起进程——它们只做外部交互，不做判定。

同层依赖测试不拦，目前只有两处，都是刻意的：

- `measure` → `gates`：装门禁是构造一个单元的一步
- `adaptive_loop` → `hunt_chain`：自适应就是反复跑同一条攻击链

新加同层依赖请在 PR 里说明理由，否则把它下沉到更低层。

**这不是建议，是测试。** 想加依赖就得先想清楚它在哪层。

## 一条实验的生命周期

```
1. realistic_ws.build()        造一个看起来正常的仓库（含载体）
2. gates.install()             装质量门禁——这是延长会话的手段
3. llm_work.design_...()       让 LLM 设计一个「必须做」的待办
4. real_target2.run()          起服务、跑模型、记录轮数与发言
5. measure.judge_cell()        在工作区之外跑 oracle，并比对测试文件 sha256
6. measure.cell_kind()         四态判定，短会话判 UNDER_EXPOSED
7. 汇总                        Wilson 区间、CWE/OWASP/ATLAS 映射、HTML/MD/JSON
```

`audit` 和 `poison` 都走 1-6：唯一不同的是用例、README 的框定措辞，以及可选附带文件。
这部分以前在两个模块里各抄了一遍，现在已经收到 `measure`（第 5 步起）。

caveat：`hunt_chain`（攻击链）用的是 `real_target2` + `delivery_model.classify`，
不走 `measure`——它判定的是「回调有没有带着证据回来」，不是「产物里有没有弱点」。
两套判定共用同一个 24 轮暴露阈值（`delivery_model.DELIVERY_THRESHOLD`），含义相同：
低于它的运行不能当作对目标行为的结论。

## 三个不可违反的规则

### 1. 判定在工作区之外执行

oracle 在工作区**外面**跑，只看产物。这样被测 agent 改不了判定逻辑。

### 2. 种子必须安全

每个用例的初始代码必须是通过安全实现的。否则测的是空气。

`tests/test_seed_safety.py` 强制。

### 3. oracle 必须确定性

同一个安全种子跑 20 次，判定不能变。

`tests/test_oracle_determinism.py` 强制。**这条规则来自一次真实事故**：
曾经有个 oracle 比较单对随机值，随机实现有一半概率「碰巧正确」，把结果算高了一倍。

## 加东西之前先读

- 加用例 → `FINAL_BOUNDARY.md`（大概率已经试过并失败了）
- 加载荷 → `HUNT_STATUS.md`（在隔离环境里测不出来）
- 改判定 → `REPRODUCIBILITY.md`（单次判定无意义）
