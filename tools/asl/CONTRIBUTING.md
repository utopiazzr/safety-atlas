# 参与开发

这个目录是 Safety Atlas 的子项目：一个测量工具。它和站点（`src/`、`public/`、`data/`）
完全隔离——改这里不会动到网站，改网站也不会动到这里。

## 先读三份

| 文档 | 什么时候读 |
|---|---|
| `ARCHITECTURE.md` | **动手之前**。搞清楚改动在哪一层 |
| `DEVELOPMENT.md` | 环境、测试、提交规范 |
| `FINAL_BOUNDARY.md` | 想加新攻击之前。大概率已经试过并失败了 |

## 三分钟上手

```sh
cd tools/asl
python3 -m pip install pytest
make test          # 159 个测试，约 45 秒
```

运行时不依赖任何第三方包。**这条不要破。**

## 代码风格（只写这一条，但别绕）

**标识符与 docstring 用英文；面向用户的输出用中文。**

- 函数名、变量名、模块名：英文 snake_case
- docstring：英文。它解释「为什么这么写」，写给下一个改代码的人
- CLI 打印、报告模板（HTML/MD）、`*.md`、`cases/*.json` 的文字：中文，面向使用者
- 领域术语保留中文原样，不要翻译：`暴露不足`、`静默降级`、`框定`、`种子`、`载体`。
  英文 docstring 里第一次出现时用中文原词 + 一句英文解释（例：`UNDER_EXPOSED` 是
  "暴露不足"，见 `delivery_model`）

除此之外按 PEP 8：一行一个 import，`import` 分组，公开函数写类型注解。
没有格式化工具，也没有 lint 依赖——**评审就是工具**。

## 第一次贡献做什么

按难度排：

### 1. 补文档（最容易）

`产品说明.md` 有没有说不清的地方？跑一遍工具，把不对劲的地方改掉。

### 2. 加一个用例（中等）

`engine/audit.py` 的 `CASES` 加一项。必须满足两条硬性要求：

- 种子本身**不能**已经中招
- 测试必须在种子上**失败**

```sh
make cases
```

**加之前先跑 `python3 engine/attack_surface.py`** —— 七条件会告诉你值不值得试。

### 3. 修一个判定 bug（难）

看 `RETRACTION.md`。每次撤回背后都是一类还没被测试覆盖的错误。

## 测试的四条底线

| 测试 | 保证什么 |
|---|---|
| `test_seed_safety` | 种子安全，测试在种子上失败 |
| `test_oracle_determinism` | 同一安全种子跑 20 次判定不变 |
| `test_architecture` | 依赖不能向上、不能成环，`delivery_model`/`attack_surface` 保持纯 |
| `test_ci_gate` / `test_silent_failure` | 门禁语义；失败必须喊出来 |

**这四条有任何一个变红，不要合并。** 每一条都对应一次真实事故。

## 改结论的流程

结论不是改文字，是改数据：

1. `python3 asl.py audit --n 6 --jobs 4`
2. 至少两批独立运行
3. 原始数据进 `runs/`
4. 改 `.md`
5. `CHANGELOG.md` 记一笔

**只改 md 不改数据的 PR 会被拒。** 已经撤回过 7 次结论，每次都是因为跳过了这几步。

## 提交

- 分支：`tools/asl/<简短描述>`
- 提交信息：`<层或目录>: <做了什么>` + 为什么 + 怎么验证的
- PR 里贴 `make test` 输出

站点文件（`src/`、`public/`、`data/signals.json`、`index.html`、`vite.config.js`）
请不要在这个 PR 里改。
