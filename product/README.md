# Safety Atlas 智能体安全插件

接到自己的 Python 工具调用上，得到非攻击性的行为评测、工具监控、修复建议和可复测的结果。插件在本地运行，移除 wrapper 即可拔出。网站负责理解产品、浏览器评测和查看同一结果。

## 快速开始

需要 Python 3.11+，无需克隆仓库或提供模型密钥：

```bash
python -m pip install https://github.com/utopiazzr/safety-atlas/releases/download/product-v0.2.0/scisec_agent_product-0.2.0-py3-none-any.whl
scisec-agent quickstart --open
```

第二条命令创建普通文本文件，实际调用一个受控读取工具，再生成并打开本地 HTML。它用于确认安装与结果链路，文件在新建的 `safety-runs/first-run-*` 目录中。

## 接到自己的工具

```python
from scisec_agent import SafetyPlugin

with SafetyPlugin() as safety:
    checked_tool = safety.wrap_tool(your_tool)
    result = checked_tool()  # 传入原工具所需参数
```

将 `your_tool` 替换为已有函数。返回值与异常继续传给应用；插件记录状态而不保存参数、返回值或异常正文。同步和 async 函数均支持，关闭前需等待所有工具调用完成。

每次运行自动创建新目录，包含 `report.html`、`report.json`、行为记录、监控文件、策略与 manifest。打开本地 HTML，或到[网站产品页](https://utopiazzr.github.io/safety-atlas/#product) 打开 `report.json`。网页本地解析，不上传该文件。

默认观察工具状态。未提供权威业务策略时，权限结果标为未知。需要权限评测、调用前拦截、LangChain 中间件、回答依据评分时，按[接入指南](INTEGRATION.md) 配置。

## 已有记录也能用

下面命令适用于已克隆本仓库的开发者：

```bash
python -m pip install ./product
scisec-agent run-pipeline product/examples/normal-workflow/manifest.json report.json --html report.html
```

流水线不会执行目标智能体或攻击载荷。权限判断必须来自调用方提供的权威策略；模型评测结果不会覆盖确定性权限判断。结果 HTML 不包含原始资源名、工具参数或回答正文。

`manifest.json` 可以按需提供以下输入：

- `workspace`：只读检查用户选择目录的可用空间，不把文件夹宣称为沙箱；
- `behavior`：结构化行为轨迹及独立策略，用于越权、误拦截、报告不一致和证据缺失检查；
- `monitor_events`：脱敏工具 span；
- `guard_events`：工具策略中间件的允许/阻断计数；
- `faithfulness_ledger`：本地 SQLite 评测账本状态。

完整评测账本必须放在可靠的本地文件系统。批量 JSONL 结果可以写到已验证的外挂存储，但对象存储挂载不能承载活动 SQLite/WAL。一次小样本读写验证不代表生产容量或持久性。

可选集成分别安装 `otel`、`langchain`、`langchain-guard`、`resource-guard` 或 `faithfulness` extra。当前实现提供接入点和可审计证据，不构成智能体安全保证。
