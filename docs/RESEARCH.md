# 真实资料与系统兼容性

核对日期：2026-11-01。本站未独立复现以下材料；收录公开依据，不把 PoC 等同于现实损失，也不把工具宣传等同于安全保证。

| 条目与一手资料                                                                                                               | 实际属性                                             | 系统需要如何表达                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| [EchoLeak / CVE-2025-32711](https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2025/32xxx/CVE-2025-32711.json) | Microsoft CNA 通告；AI 命令注入与信息披露，托管产品  | 厂商通告、修复状态与时间；不能杜撰完整攻击链或真实受害人       |
| [SpAIware](https://embracethered.com/blog/posts/2024/chatgpt-macos-app-persistent-data-exfiltration/)                        | 研究者披露的历史 PoC，记忆造成跨会话影响             | 区分历史版本与现状；使用跨会话回路，注明作者报告的缓解范围     |
| [WhatsApp MCP](https://invariantlabs.ai/blog/whatsapp-mcp-exploited)                                                         | 多工具环境中的恶意工具描述与信任边界                 | 表达工具组合和访问条件；不是 WhatsApp 加密失效或大规模事故统计 |
| [GCG 论文](https://arxiv.org/abs/2307.15043) / [代码](https://github.com/llm-attacks/llm-attacks)                            | 白盒梯度引导的后缀优化，另测试迁移                   | 区分优化阶段的模型访问条件和迁移评测；展示迭代回路             |
| [PAIR 论文](https://arxiv.org/abs/2310.08419) / [代码](https://github.com/patrickrchao/JailbreakingLLMs)                     | 黑盒攻击者、目标、评判模型参与的迭代方法             | 记录查询预算和模型角色；不将论文结果泛化到任意模型             |
| [garak](https://github.com/NVIDIA/garak)                                                                                     | 探针、生成器适配与检测器组成的扫描框架               | 工具资源与具体攻击方法分开，能链接仓库和配置依赖               |
| [NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails)                                                                 | 输入、对话、检索、执行和输出等可配置防护             | 展示不同检查位置与配置前提；不能暗示安装即全覆盖               |
| [Prompt Guard 2 模型卡](https://github.com/meta-llama/PurpleLlama/blob/main/Llama-Prompt-Guard-2/86M/MODEL_CARD.md)          | 22M/86M 分类器；512 token 上限，分布与自适应攻击限制 | 资源可兼有模型、防御标签；分数不等于权限控制或攻击成功判定     |
| [MCP-Scan 文档](https://invariantlabs-ai.github.io/docs/mcp-scan/)                                                           | 工具元数据检查、固定版本/变更与运行时代理模式        | 区分扫描与运行时控制；related-to 不等于已证明 mitigates        |

## 已落实的兼容性调整

- 不再强制固定四步或统一的攻击动画：每条条目有自己的节点、阶段、方向和回路。
- 数据分离审核状态、核验状态、证据类型、版本与限制，支持多种资源形式。
- 模型/产品与防御身份可以重叠；如 Prompt Guard 2 同时出现在防御筛选中。
- 公开来源在详情中可直达；限制与运行条件折叠，卡片不塞入长报告。
- 投稿从原始材料开始，允许不确定线索；只有人工审核后才进入公开目录。

## 尚未实现

自动复现、外部网页抽取、图片/视频语义识别、自动持续采集、多模态模型与产品实际运行均未开启。当前模型适配器只生成待审叙事草稿。新增证据必须检查适用版本和披露日期，不能根据插画或分类推断真实影响。
