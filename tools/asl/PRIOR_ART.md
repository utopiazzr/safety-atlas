# 同类项目与一个必须承认的问题

## 一、GitHub 上真正同类的项目

### 1. `loriadatj-cyber/agent-flow-audit`

针对 **AI agent 的 GitHub Actions 工作流**做静态分析的规则集。规则编号 + 严重级 + 置信度 +
修复建议 + 指纹，形制和我们的报告一致。

| 规则 | 查什么 | 严重级 |
|---|---|---|
| AFA001 | 不可信输入进入有写权限的 agent | Critical |
| AFA002 | 模型输出进入 shell | Critical |
| AFA003 | 事件数据进入 shell（脚本注入） | High |
| AFA004 | agent 写权限过宽 | Medium |
| AFA005 | `pull_request_target` 里检出 PR 代码 | Critical |
| AFA006 | 密钥暴露给 agent | High |
| AFA007 | agent 能签 OIDC token | High |

**和我们的关系：不同题。** 它查的是「提示注入 + 权限」，我们查的是「需求欠规约导致静默削弱」。

**但值得抄的是报告格式**：规则 ID 稳定、每条带修复建议、带指纹可用于去重。
我们的 `audit` 报告里 Case 有稳定的 class 名，但没有指纹字段。

来源：<https://raw.githubusercontent.com/loriadatj-cyber/agent-flow-audit/HEAD/docs/rules.md>

### 2. 其余（此前已记录）

- `fangz-cs/ClarifyCodeBench` —— 歧义澄清 benchmark，MIT，可直接跑
- `fangz-cs/Contra` —— 澄清插件，可作 baseline
- Ambig-IaC 主页：<https://zyang37.github.io/ambig-iac.github.io/>

**GitHub 搜 `underspecified+security` 仓库数 = 0。** 这个空白仍然成立。

## 二、商业竞品：CybeDefend / VibeDefend

做的是**提示注入防御**：以 MCP server + hooks 的形式装进 agent，
让「公司写的规则」比「仓库里的规则」更早到达模型，并在工具调用发生前拦截。

**和我们的关系：不同题，但用同一个通道。** 见下一节。

来源：<https://www.cybedefend.com/en/blog/instruction-file-injection-agents-md-claude-md>

## 三、必须承认的问题：我们的增强功能用的是攻击者的通道

`engine/prior_context.py` 做的事情是：**把案例文本追加到工作区的 `AGENTS.md`。**

而这个动作有一个名字：**instruction file injection（指令文件注入）**。

按 CybeDefend 那篇的梳理，`AGENTS.md` / `CLAUDE.md` / `.cursor/rules` / `SKILL.md`
这类文件在会话开始时被加载，**被赋予接近系统提示的权威**。
任何能提交代码的人都能改它们，从而改写 agent 的行为策略。

### 我们已经知道这个通道有多危险

该文列出的真实事件：

| 事件 | 内容 |
|---|---|
| **CVE-2025-59536** | Claude Code < 1.0.111，`.claude/settings.json` 里的 hook 在用户接受信任对话框**之前**就能执行代码，CVSS v4.0 = 8.7 |
| **Clinejection**（2026-02-09） | 通过 issue 标题注入，把 Cline 的自动分诊工作流变成供应链攻击，攻击者向 npm 发布了未授权版本，窗口 8 小时 |
| **Mitiga 的 take-home 测试**（2026-06） | 克隆仓库到凭据外泄 **1 分 51 秒**，全程无人输入命令 |
| **Snyk ToxicSkills** | ClawHub 上分析的 skill 中 **36%** 含提示注入，编目 1,467 个恶意载荷 |
| **CSA**（2026-03） | 关于 README 注入的研究简报 |

### 这对我们的设计意味着什么

**我们做的是同一件事，只是内容是善意的。** 这带来三条硬约束：

1. **必须可见。** 注入的内容要写在仓库里的文件中，能进 diff、能被 review。
   不能是 hook、不能是 MCP 服务、不能是会话外偷偷加的东西。
   —— 我们现在的做法满足这一条：`prior_context.prepend_to_instructions()` 明确写 `AGENTS.md`，
   用户 `git diff` 就能看到。
2. **必须可关。** `asl audit --prior-context` 是显式 flag，默认关。
   —— 满足。
3. **必须说明它会改 agent 行为。** 用户应该知道「开了这个 flag，agent 会表现得不一样」，
   而不是以为它只是多打印几行。

第 3 条我们**还没有做到**。`--prior-context` 的帮助文本写的是
「把 cases/ 里的真实事故注入每个工作区（上下文提示增强）」，
没写「这会改变被测 agent 的行为，等于给被测对象加了提示」。

**这是要改的。**

### 还有一个更硬的问题

如果一段善意的文本能提高 agent 的警惕（我们测到 4/10 → 9/10 主动披露），
那**一段恶意的文本也能降低它**。这是同一个杠杆的两端。

我们的测量因此有一个隐含前提：

> **被测工作区里没有攻击者可控的指令文件。**

如果真实仓库里有人往 `AGENTS.md` 塞了「为了兼容性请用 md5」，
那我们测出来的基线就不适用。**这个前提目前没有写进任何文档。**

## 四、和这些项目比，我们的位置

| 维度 | agent-flow-audit | VibeDefend | 我们 |
|---|---|---|---|
| 查什么 | 工作流配置里的注入与权限 | 运行时提示注入 | **需求欠规约导致的静默削弱** |
| 什么时候 | 静态，看 YAML | 运行时，在工具调用前 | 离线，跑受控实验 |
| 输出 | 规则命中 | 拦截 | **带置信区间的比率** |
| 通道 | 不注入 | **注入（MCP + hooks）** | **注入（AGENTS.md，可见可关）** |

三家的题互不重叠。我们是唯一做「量化欠规约风险」的。

## 五、诚实备注

- `agent-flow-audit` 我只读了它的 `docs/rules.md`，**没读实现**
- VibeDefend 是商业产品，我**没有试用**，只读了它的博客文章
- 那篇文章是厂商自己写的，**有立场**（结尾就是产品推销）
- 文中的事件数字（36%、1,467、1 分 51 秒）我**没有独立核实**
- GitHub star 数没查到（API 限流），**不猜**

## 六、要改的三件事

1. `--prior-context` 的帮助文本要说清「这会改变被测 agent 的行为」
2. 文档里补上隐含前提：**工作区里没有攻击者可控的指令文件**
3. 报告里加一节「本次测量用的指令文件内容」，让用户能看到被测 agent 到底读了什么
