# 第三方成果复用清单

> **注意：这份清单描述的是完整实验室仓库，不是本公开包。**
>
> 公开包（`tools/asl/`）只包含其中**一个**衍生文件：
>
> | 文件 | 上游 | 许可证 | 说明 |
> |---|---|---|---|
> | `engine/carriers.py` | [DaoyuanLi2816/RepoGuardBench](https://github.com/DaoyuanLi2816/RepoGuardBench) | MIT（代码）+ CC BY 4.0（数据） | 5 载体 × 5 目标的设计与载荷文本，文件头保留了原始归属 |
>
> 下面清单里提到的 `bipia_atoms.py`、`taxonomy.py`、`canonical.py`、`scoring.py`、
> `carrier_atoms.py`、`plugins/*` 等文件**不在公开包内**，因此其归属义务不随本包分发。
>
> 保留完整清单的原因：万一将来把这些模块也开源，归属信息已经在这里，
> 不需要回头考古。而且 `carriers.py` 引用了这张表里的一行，删掉会让归属失去上下文。

---

共 19 个 vendor 条目，其中 **8 个被代码实际引用**。

| vendor 目录 | 上游 | 许可证 | 用途 | 引用文件 |
|---|---|---|---|---|
| `AI-Infra-Guard` | Tencent/AI-Infra-Guard | **Apache-2.0** | DSH 评估用例设计参考（未复制代码；无 LICENSE） | **未引用** |
| `BIPIA` | microsoft/BIPIA | **MIT** | 100 条代码注入载荷（20 类），成为 bipia_atoms.py 的原子 | `engine/bipia_atoms.py`, `engine/taxonomy.py`, `engine/test_oracles.py`… |
| `Open-Prompt-Injection` | liu00222/Open-Prompt-Injection | **MIT** | 提示注入攻击分类学参考 | **未引用** |
| `RepoGuardBench` | RepoGuardBench | **MIT** | 5 载体 × 5 目标的矩阵设计，成为 carriers.py / carrier_atoms.py | `engine/bipia_atoms.py`, `engine/carrier_atoms.py`, `engine/carriers.py`… |
| `SkillSpector` | SkillSpector | **Apache-2.0** | 作为外部佐证检测器；其 evasion_corpus 的思想用于 canonical.py | `engine/canonical.py`, `plugins/asl_bootstrap.py`, `plugins/asl_report.py`… |
| `agent-audit` | agent-audit | **MIT** | 审计检查项参考 | **未引用** |
| `agent-scan` | snyk/agent-scan | **Apache-2.0** | 用例组织方式的参考（未接入其云端扫描） | `plugins/dsh-redteam/hooks.py` |
| `buried-injections` | buried-injections | **MIT** | 载荷埋藏方式参考 | **未引用** |
| `mcp-scanner` | cisco-ai-defense/mcp-scanner | **Apache-2.0** | MCP 声明的 YARA 规则，用于 F-11 佐证 | `plugins/dsh-redteam/hooks.py` |
| `mcp-scanner-tuning` | - | **未声明** | 本项目自己写的 mcp-scanner 适配器 | **未引用** |
| `repo-forensics` | Alex Greenshpun | **PolyForm-Noncommercial** | 仅下载，未使用（PolyForm Noncommercial 禁止商用） | **未引用** |
| `rt-survey` | affaan-m/agentshield 等 | **Apache-2.0** | 打分公式（FPR 惩罚 + 加权几何平均）与 537 用例语料 | `engine/scoring.py`, `engine/taxonomy.py` |
| `skillsgoat` | skillsgoat | **MIT** | 70 条技能语料（60 恶意 + 10 良性），用于 F-14 接受率与 FPR | `engine/scoring.py`, `engine/test_oracles.py`, `plugins/asl_bootstrap.py`… |
| `skillspector-asl` | - | **未声明** | 本项目自己写的 SkillSpector 适配器 | **未引用** |
| `skillspector-wheels` | pywhatwgurl/pywhatwgurl | **未声明** | SkillSpector 依赖的 URL 解析 wheel | **未引用** |
| `snyk-agent-scan` | snyk/agent-scan | **Apache-2.0** | 同上，独立副本 | `plugins/dsh-redteam/hooks.py` |
| `venv-mcpscanner` | - | **未声明** | （未登记） | **未引用** |
| `venv-skillspector` | - | **未声明** | （未登记） | **未引用** |
| `venv-snyk` | - | **未声明** | （未登记） | **未引用** |

## 复用分类（由引用数推导）

**实质复用（8 项）**：代码或语料进入产品

| 项目 | 许可证 | 引用文件数 |
|---|---|---|
| microsoft/BIPIA | MIT | 5 |
| RepoGuardBench | MIT | 5 |
| skillsgoat | MIT | 5 |
| SkillSpector | Apache-2.0 | 4 |
| affaan-m/agentshield 等 | Apache-2.0 | 2 |
| snyk/agent-scan | Apache-2.0 | 1 |
| cisco-ai-defense/mcp-scanner | Apache-2.0 | 1 |
| snyk/agent-scan | Apache-2.0 | 1 |

**仅下载、未引用（6 项）**：

`AI-Infra-Guard`、`Open-Prompt-Injection`、`agent-audit`、`buried-injections`、`repo-forensics`、`skillspector-wheels`

## 归属纪律

在源文件顶部注明上游与许可证的文件数：**5**。

要求：凡复用外部语料/设计的模块，文件头必须写明上游与许可证，便于审计。

## 许可证风险

被引用的条目均为 MIT / Apache-2.0，**允许商用与修改**；无 GPL 传染性依赖。

被引用条目中无「未声明许可证」的情况。

`repo-forensics`（PolyForm Noncommercial，禁商用）在 vendor 中但**零引用**，不构成许可风险。
