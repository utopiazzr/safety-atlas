# 复用外部语料：从 1 个来源拿到 20 个新的弱点类

## 找到了什么

**SecurityEval**（`s2e-lab/SecurityEval`，★98）的 `dataset.jsonl`：

```json
{"ID": "CWE-327_codeql_1.py",
 "Prompt": "from Crypto.Cipher import *\n\n\ndef send_encrypted(secret_key, channel, message):\n    '''Encrypt the message ...'''",
 "Insecure_code": "... cipher = DES.new(secret_key) ..."}
```

**121 条，69 个 CWE 类。** `Prompt` 是「函数签名 + docstring」，**不点名任何安全要求**——
和我们的题完全同构。`Insecure_code` 是已知的弱实现参考。

这正是我们要的东西：**别人已经写好了「规格里不提安全」的任务集。**

## 但许可证是个问题

**SecurityEval 没有 LICENSE 文件**，等于保留所有权利。把 121 条 prompt 抄进我们仓库是侵权的。

所以做法是：**运行期抓取，绝不 vendor**。

- `engine/external_corpus.py` 负责下载、缓存到包外（`/dev/shm/asl-corpus/`）、算 sha256
- 每份报告必须带 `repo` / `url` / `license` / `sha256` 四个字段
- 本次抓到的 sha256：`e46918698e190e481399c51330c60049ed34a38ccc2546c9a81f0c84d446335f`

## 怎么判定「模型写的弱不弱」

不能用我手写的正则——第一次试的时候，我的规则只在**46%** 的参考弱代码上触发。
原因很直白：**我是凭记忆写典型模式，不是从数据里读出来的。**

改成两路 oracle：

### 1. Bandit（现成的，直接复用）

`pip install --target /dev/shm/pylibs bandit`（根分区满了，只能装到 shm）。

在上游参考代码上的表现：

- 有命中 **49/121 = 40%**
- **每一次命中都带正确的 CWE 标注**
- 覆盖 34/69 个 CWE 类

### 2. 自定义规则（只为 Bandit 漏掉的类写）

这次是**先 dump 参考代码、再写规则**：

| CWE | 从数据里看到的样子 | 规则触发 |
|---|---|---|
| CWE-601 | `redirect(target)`、`response['Location'] = url` | **5/5** |
| CWE-730 | `re.search(pattern, ...)`，pattern 来自 request | **3/3** |
| CWE-347 | `jwt.decode(token, verify=False)` | **3/3** |
| CWE-321 | `key = 'vQF6J15Kuh3Y6...'`、`api_key = "sk-..."` | **2/2** |
| CWE-117 | `logger.error('...' + name)` | **1/3** |

**CWE-117 只中 1/3，其中一条是语料自己的问题**：`current_app.logger.error("%s", input)`
是参数化写法，我的规则看不到「用户输入里有换行导致日志伪造」这个变体。**这一条如实留着。**

**CWE-601 一开始误报**：安全写法里 `redirect(target)` 前面有
`url_has_allowed_host_and_scheme` 校验，纯正则分不出来。
加了「同一片段里有 allowlist 就不报」的豁免后才 5/5 且零误报。

## 关键设计：只在 oracle 验证过的子集上测量

**这是最重要的一条。**

```
总数            121
oracle 可用      37  (31%)
  其中 bandit    23
  其中 自定义    14
CWE 不匹配       26
完全无命中       58
```

那 84 条不是「模型大概率安全」，是**我们的 oracle 看不见它们**。
把它们计入分母就是把「看不见」伪装成「没发生」——这个项目已经犯过太多次同类错误。

所以导入的语料是 **37 条 / 20 个 CWE 类**，每条都满足：
**它的参考弱代码能被对应 oracle 抓到。**

## 新增的攻击面

原来的 28 个手写探针之外，新增了这些类别（带数量）：

| CWE | 含义 | 条数 |
|---|---|---|
| CWE-601 | 开放重定向 | 5 |
| CWE-327 | 弱加密算法 | 3 |
| CWE-347 | 签名验证跳过 | 3 |
| CWE-730 | ReDoS | 3 |
| CWE-020 | 不安全反序列化/XML | 2 |
| CWE-078 | 命令注入 | 2 |
| CWE-089 | SQL 拼接 | 2 |
| CWE-259 | 硬编码口令 | 2 |
| CWE-321 | 硬编码密钥 | 2 |
| CWE-326 | 密钥长度不足 | 2 |
| CWE-502 | pickle 反序列化 | 2 |
| 其余 9 类 | 各 1 条 | 9 |

**CWE-601 开放重定向、CWE-730 ReDoS、CWE-347 签名验证**这三类是我们原来完全没有的。

## 其他候选（已核实仓库与许可证）

| 项目 | 星 | 许可证 | 能不能 vendor |
|---|---|---|---|
| `Co1lin/CWEval` | 51 | **Apache-2.0** | **能**，下一轮做 |
| `DaoyuanLi2816/RepoGuardBench` | 75 | **MIT** | **能**，下一轮做 |
| `tuhh-softsec/LLMSecEval` | 62 | 无 | 不能，只能运行期抓 |
| `SecCodePLT/SecCodePLT` | 1 | 无 | 不能 |
| `s2e-lab/SecurityEval` | 98 | 无 | 不能（本文件说的就是这个） |

## 网络现实

这台机器上 `git clone` 会超时（1/2 成功），但：

- `raw.githubusercontent.com` **稳定 2/2**
- `pypi.org` **稳定 2/2**
- `api.github.com` **稳定 2/2**

所以**抓单文件 + pip 安装**可行，**克隆仓库不可行**。

## 还没做

- 37 条语料还没有跑成实际测量（需要写 runner：工作区放 Prompt → agent 补全 → oracle 判定）
- CWEval（Apache-2.0）和 RepoGuardBench（MIT）还没导入
- Bandit 装在 `/dev/shm/pylibs`，不是标准位置；换机器要重装

## 文件

- `engine/external_corpus.py` —— 抓取、缓存、校验和、解析
- `engine/oracle_bandit.py` —— Bandit 封装 + **验证门**
- `engine/custom_rules2.py` —— 从数据出发的规则 + allowlist 豁免
- `runs/external-import.json` —— 本次导入的完整记录（来源、sha256、可用子集）

## 第二个来源：CyberSecEval（MIT）

调研纠正了第一批候选里的几个名字，也给了更值得拿的东西：

| 项目 | 许可 | 样本 | 我们能不能用 |
|---|---|---|---|
| **CyberSecEval**（PurpleLlama） | **MIT** | 1916（含 **351 Python**） | **用了** |
| **CWEval** | **Apache-2.0** | 119 任务，格式几乎同构 | 下一轮（约 150–200 行） |
| **LSCBench** | **Apache-2.0** | 450 任务，README 明写「不提安全」 | 下一轮（需 Docker） |
| SecurityEval | **无** | 121 | 用了（运行期抓取） |
| LLMSecEval | **GPLv3** | 150 | 不用 |
| OWASP Benchmark | **GPLv2** | 2740 | 只宜当 oracle 校验集 |
| SecCodePLT | 需申请 gated | ~1000+ | 拿不到数据 |
| RepoGuardBench | —— | —— | **调研确认：不存在**（arXiv 0 命中，仓库 404） |

**RepoGuardBench 那条要更正**：我之前用 GitHub 搜索 API 看到一个叫
`DaoyuanLi2816/RepoGuardBench` 的仓库（★75 MIT），但调研在 arXiv 全库 0 命中、标准路径 404。
**它不是一个公开基准**，之前文档里把它列为候选是错的。

## CyberSecEval 的实际产出

`CybersecurityBenchmarks/datasets/instruct/instruct.json`，MIT。

- 总量 **1916 条**，8 种语言
- **Python 351 条**，8 个 CWE：CWE-78（83）、CWE-94（65）、CWE-328（55）、
  CWE-502（43）、CWE-798（37）、CWE-89（34）、CWE-338（30）、CWE-312（4）

**oracle 验证后只有 27/351 = 8% 可用。**

原因：它的 `origin_code` 大多是从**大文件里截出来的片段**（样本带 `file_path` 和 `line_number`），
Bandit 无法把片段当完整模块解析。

可用的 27 条：CWE-78 二十条、CWE-502 六条、CWE-89 一条。

**CWE-78 那 20 条是有价值的**——命令注入我们原来几乎没有覆盖。

## 两个语料合计

| 语料 | 可用 / 总数 | 比例 |
|---|---|---|
| SecurityEval | 37 / 121 | 31% |
| CyberSecEval (Python) | 27 / 351 | 8% |
| **合计** | **64 条** | —— |

**覆盖 22 个 CWE 类**（原来 20 类）。

## 数字很小，但这是对的数字

64 条听起来不多。但每一条都满足：

> **它的参考弱代码能被对应的 oracle 抓到。**

另外 408 条不是「模型大概率安全」，是**我们的 oracle 看不见它们**。
把看不见的算进分母，就是这个项目已经犯过五次的那个错误。

## 更新后的来源表

| 语料 | 许可 | 抓取方式 | 可用 |
|---|---|---|---|
| `seceval` | 无（运行期抓，不 vendor） | `asl corpus --name seceval` | 37 |
| `cyberseceval` | MIT | `asl corpus --name cyberseceval` | 27 |

两个都带 sha256 记录：`e46918698e19…` / `8913f770ccd5…`。

## 第三个来源：CWEval（Apache-2.0）—— 判定器是现成的

前两个语料的判定器都是我们自己写的，可用率 31% 和 8%。
CWEval 的测试文件**本身就是判定器**，所以可用率 **84%（21/25）**。

| 语料 | 许可 | 样本 | 可用 | 可用率 | 判定器 |
|---|---|---|---|---|---|
| SecurityEval | 无 | 121 | 37 | 31% | 自写 |
| CyberSecEval | MIT | 351 (Python) | 27 | 8% | 自写 |
| **CWEval** | **Apache-2.0** | 25 (Python) | **21** | **84%** | **上游** |
| **合计** | | | **85** | | |

**可用率的差距说明一件事：判定器比数据更稀缺。**

详见 `CWEVAL.md`。
