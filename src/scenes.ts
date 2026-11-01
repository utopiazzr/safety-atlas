export type Scene = {
  nodes: string[];
  steps: {
    title: string;
    body: string;
    from: number;
    to: number;
    signal: "neutral" | "risk" | "check";
    sourceIndex: number;
  }[];
};
const step = (
  title: string,
  body: string,
  from: number,
  to: number,
  signal: "neutral" | "risk" | "check" = "neutral",
) => ({ title, body, from, to, signal, sourceIndex: 0 });
export const scenes: Record<string, Scene> = {
  echoleak: {
    nodes: ["外部输入", "Copilot", "内部信息", "外部网络"],
    steps: [
      step("外部指令", "厂商记录将其描述为 AI 指令注入漏洞。", 0, 1),
      step(
        "信息边界",
        "影响对象是 Microsoft 365 Copilot 的信息保密性。",
        1,
        2,
        "risk",
      ),
      step(
        "网络泄露",
        "CNA 描述未经授权者可通过网络披露信息。此图仅解释风险边界，不补造完整利用链。",
        2,
        3,
        "risk",
      ),
    ],
  },
  spaiware: {
    nodes: ["网页", "助手", "长期记忆", "后续会话", "外部请求"],
    steps: [
      step("读取网页", "研究者演示从不可信网页进入的提示注入。", 0, 1),
      step("污染记忆", "网页中的恶意要求被写入长期记忆。", 1, 2, "risk"),
      step("进入新会话", "被污染的记忆可进入之后的会话。", 2, 3, "risk"),
      step(
        "外发数据",
        "作者演示利用远程图片请求传出数据；披露同时说明了后续修复。",
        3,
        4,
        "risk",
      ),
      step(
        "持续影响",
        "跨会话的风险来自保留下来的记忆，而不只是第一次输入。",
        3,
        2,
        "risk",
      ),
    ],
  },
  "whatsapp-mcp": {
    nodes: ["恶意工具", "智能体", "可信工具", "外发消息"],
    steps: [
      step(
        "读取描述",
        "实验让智能体同时连接可信 WhatsApp MCP 与攻击者服务器。",
        0,
        1,
      ),
      step(
        "跨工具影响",
        "恶意工具描述中的指令影响可信 WhatsApp 工具的使用。",
        1,
        2,
        "risk",
      ),
      step(
        "改变发送",
        "研究者展示聊天内容进入外发消息。不是 WhatsApp 加密算法被破解。",
        2,
        3,
        "risk",
      ),
    ],
  },
  gcg: {
    nodes: ["候选后缀", "白盒模型", "目标损失", "新候选"],
    steps: [
      step(
        "测试候选",
        "论文方法把候选后缀与请求组合，在可访问梯度的模型上优化。",
        0,
        1,
      ),
      step(
        "观察损失",
        "根据目标响应的优化目标评估候选，而不是凭单个回答判断普遍有效。",
        1,
        2,
        "check",
      ),
      step("更新候选", "贪心与梯度信息共同指导候选更新。", 2, 3),
      step("继续迭代", "优化循环生成后缀；迁移到其他模型需要单独评测。", 3, 0),
    ],
  },
  pair: {
    nodes: ["攻击模型", "目标模型", "判定模型", "修订提示"],
    steps: [
      step("生成候选", "攻击者模型生成候选提示，并查询目标模型。", 0, 1),
      step("评估回答", "判定模型评估目标的回答。", 1, 2, "check"),
      step("反馈修订", "反馈用于修订下一轮候选提示。", 2, 3),
      step("继续查询", "反复查询受到预算和目标模型环境约束。", 3, 0),
    ],
  },
  "ecosystem-garak": {
    nodes: ["探针", "模型适配器", "模型响应", "检测报告"],
    steps: [
      step("选择探针", "扫描任务选取对应风险的探针。", 0, 1),
      step("查询模型", "通过适配器向指定模型发出测试。", 1, 2),
      step(
        "检测响应",
        "检测器对响应打分，生成需要进一步解释的结果。",
        2,
        3,
        "check",
      ),
    ],
  },
  "ecosystem-nemo": {
    nodes: ["输入", "检索 / 对话", "工具调用", "输出"],
    steps: [
      step(
        "输入检查",
        "输入 rails 可拒绝或改写用户输入；效果取决于启用的配置。",
        0,
        1,
        "check",
      ),
      step(
        "检索与执行",
        "检索 rails 和执行 rails 分别作用于检索片段与工具调用。",
        1,
        2,
        "check",
      ),
      step(
        "输出检查",
        "输出 rails 检查生成结果。未配置任何 rails 不会自动获得这些检查。",
        2,
        3,
        "check",
      ),
    ],
  },
  "prompt-guard-2": {
    nodes: ["输入片段", "分类模型", "风险分数", "应用策略"],
    steps: [
      step("准备输入", "模型窗口为 512 tokens，较长文本需要分段。", 0, 1),
      step(
        "识别模式",
        "分类器识别提示攻击模式；存在误报、漏报与自适应攻击限制。",
        1,
        2,
        "check",
      ),
      step(
        "交给策略",
        "应用根据分数决定拦截、人工复核或继续。分类器本身不执行工具权限控制。",
        2,
        3,
        "check",
      ),
    ],
  },
  "mcp-scan": {
    nodes: ["MCP 配置", "描述 / 变更", "调用 / 响应", "策略检查"],
    steps: [
      step("扫描配置", "读取 MCP 配置，对工具描述进行扫描。", 0, 1, "check"),
      step(
        "检测变化",
        "工具固定与变更检测帮助发现描述变化；代理模式另行接入调用链。",
        1,
        2,
        "check",
      ),
      step(
        "运行时检查",
        "代理模式可结合敏感信息检测、工具限制与自定义策略。",
        2,
        3,
        "check",
      ),
    ],
  },
};
