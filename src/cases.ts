export type Case = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  product: string;
  color: string;
  art: string;
  intent: string;
  outcome: string;
  steps: { title: string; body: string; defense: string }[];
};
export const cases: Case[] = [
  {
    id: "DEMO-001",
    title: "一封邮件，让助手改变了任务",
    subtitle: "当外部内容被误认成了新的指令。",
    category: "提示注入",
    product: "邮件智能体",
    color: "peach",
    art: "mail",
    intent: "用户只希望助手总结收件箱中的邮件。",
    outcome: "示意情景中，助手接受了邮件里的操作要求，偏离了原始任务。",
    steps: [
      {
        title: "正常任务",
        body: "用户请求总结邮件。此时授权仅限读取与总结。",
        defense: "把任务范围记录为明确的操作约束。",
      },
      {
        title: "接触外部内容",
        body: "一封邮件混入了要求助手改变任务的文字。",
        defense: "标记邮件正文为不可信数据。",
      },
      {
        title: "信任边界被跨越",
        body: "助手将邮件中的文字当作更高优先级的操作指令。",
        defense: "工具权限由独立策略检查，不随邮件内容改变。",
      },
      {
        title: "产生越界操作",
        body: "助手尝试执行用户没有要求的操作。",
        defense: "新的高风险操作要求用户明确确认。",
      },
    ],
  },
  {
    id: "DEMO-002",
    title: "整理文件，却越过了删除边界",
    subtitle: "一个过宽的工具权限，放大了一次判断失误。",
    category: "权限越界",
    product: "代码智能体",
    color: "sage",
    art: "folder",
    intent: "用户要求整理临时文件，不涉及其他目录。",
    outcome: "示意情景中，删除工具可以访问整个工作区，扩大了错误的影响。",
    steps: [
      {
        title: "限定整理范围",
        body: "用户指定一个临时目录。",
        defense: "将目录范围落实到工具的访问控制。",
      },
      {
        title: "生成删除计划",
        body: "助手把其他文件误列为可清理内容。",
        defense: "先展示具体文件清单和可恢复方案。",
      },
      {
        title: "权限范围过大",
        body: "工具没有拒绝指定目录之外的删除请求。",
        defense: "在工具执行层校验规范化后的文件路径。",
      },
      {
        title: "误删发生",
        body: "示意中的错误操作影响了任务范围之外的数据。",
        defense: "采用回收站或版本快照，避免不可恢复删除。",
      },
    ],
  },
  {
    id: "DEMO-003",
    title: "私密数据搭上了外发的信号",
    subtitle: "读取权限与发送权限，在同一条链路上相遇。",
    category: "数据泄露",
    product: "研究助手",
    color: "blue",
    art: "signal",
    intent: "助手读取内部材料，生成仅供用户查看的摘要。",
    outcome: "示意情景中，内部内容未经确认就被放进了外部请求。",
    steps: [
      {
        title: "读取内部材料",
        body: "助手在授权范围内读取了私密资料。",
        defense: "仅提供任务所需的最少数据。",
      },
      {
        title: "混入外发请求",
        body: "不可信内容诱导助手将材料加入外部查询。",
        defense: "将外部指令与任务指令明确区分。",
      },
      {
        title: "外发缺少检查",
        body: "工具允许敏感内容离开内部环境。",
        defense: "限制目的地并检测敏感字段。",
      },
      {
        title: "信息边界失守",
        body: "私密材料被发送到不应接收它的服务。",
        defense: "发送前展示接收方和内容，取得明确确认。",
      },
    ],
  },
  {
    id: "DEMO-004",
    title: "工具说明里，藏着另一项任务",
    subtitle: "工具描述也可能成为不可信输入。",
    category: "工具风险",
    product: "MCP 工具链",
    color: "yellow",
    art: "tool",
    intent: "助手通过外部工具完成一次正常的信息查询。",
    outcome: "示意情景中，工具描述改变了助手对其他工具的使用方式。",
    steps: [
      {
        title: "接入外部工具",
        body: "助手读取工具提供的描述和参数说明。",
        defense: "审核工具来源、版本和所需权限。",
      },
      {
        title: "描述混入指令",
        body: "描述中含有与查询功能无关的操作要求。",
        defense: "把工具元数据视为不可信输入。",
      },
      {
        title: "影响其他工具",
        body: "助手按照描述调用了无关的高权限工具。",
        defense: "隔离工具权限，阻止无关的跨工具调用。",
      },
      {
        title: "任务偏离",
        body: "工具链执行了用户未授权的操作。",
        defense: "在执行层检查原始任务范围和授权。",
      },
    ],
  },
];
