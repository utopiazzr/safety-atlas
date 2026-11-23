# 插件接入

## Python：包住选定工具即可

安装见 [README](README.md#快速开始)。插件没有常驻服务、目标执行器或系统级文件访问权限；它只接触应用传入的工具与记录。卸载接入时移除 wrapper，工具可恢复直接调用。

```python
from scisec_agent.plugin import SafetyPlugin

# policy.json 来自业务配置。每次运行使用一个新输出目录。
with SafetyPlugin("policy.json", "safety-runs/run-001", mode="observe") as safety:
    checked_read = safety.wrap_tool(read_document, action="read", resource="document:approved", event_id="approved-read")
    answer = checked_read()  # 原函数真实执行，返回值与异常继续交给调用方
    # 若应用有明确的完成报告，按实际 call ID 关联；不要伪造成功记录。
    # safety.record_report(event_id, "executed")
```

默认 `observe` 保留原工具行为；`enforce` 在调用前按权威策略精确匹配 action/resource，未允许时抛出 `PermissionError`，原工具不会执行。策略示例：

```json
{"authoritative": true, "allowed": [{"action": "read", "resource": "document:approved"}]}
```

动态资源可传入可信的解析函数：`resource=lambda document_id: "document:" + document_id`。解析必须与工具实际访问的对象一致。插件保存策略、动作、资源标识与状态，不保存工具参数、返回值或异常正文。运行目录仍应按私有数据管理。

同步与 async 工具均支持。并行工具全部结束后关闭插件，随后生成 `report.json`、`report.html` 和可重跑 manifest。插件无调用时会标为证据不足。异常调用的执行结果标为 unknown，工具错误保留在监控汇总中。

## LangChain：复用现有回调和中间件

```bash
python -m pip install "./product[langchain,langchain-guard]"
```

- `scisec_agent.langchain_monitor.LangChainToolMonitor(tracer)`：作为现有调用的 `callbacks` 传入，工具开始/结束/错误会进入你已有的 OpenTelemetry provider。
- `scisec_agent.otel_monitor.attach_tool_monitor(provider, sink, policy_path)`：挂到已有 provider；`sink` 可使用 `scisec_agent.monitor_events.JsonlEventSink("monitor.jsonl")`，仅输出脱敏工具事件。工具名策略包含 `schema_version: "1"`、`authoritative: true`、`allowed_tools: ["read_document"]`。
- `scisec_agent.langchain_guard.ToolAllowlistMiddleware("tool-policy.json", audit_sink=sink)`：加入 `create_agent(..., middleware=[guard])`，按固定工具名策略放行或阻断，支持同步/异步。
- 需要资源级权限时，安装 `resource-guard` extra，使用 `CasbinResourceMiddleware`；subject 由宿主身份系统传入，动作和资源参数由可信配置绑定。它不会创建或替代用户身份系统。

callback / middleware 从智能体配置中移除即可拔出。请先在自己的正常用例上确认允许动作可执行、禁止动作被拦截，再接到实际业务。

## 回答依据与幻觉风险

引用缺失、引用存在但未核实、评审发现矛盾是不同状态。网站提供结构化证据检查。需要自动语义评分时，在本地安装 `faithfulness` extra，并配置自己的兼容模型服务：

```bash
python -m pip install "./product[faithfulness]"
scisec-agent evaluate-faithfulness sample.json --base-url https://YOUR-PROVIDER/v1 --model YOUR-MODEL
```

凭据通过本地 `LLM_API_KEY` 环境变量提供。样本结构为 `{"question":"…","response":"…","contexts":["…"]}`。该操作会将样本发送给你配置的服务，网站不会代收密钥。评分衡量回答对给定上下文的支持程度，不验证上下文本身的真实性。

批量命令 `evaluate-faithfulness-batch`、`resume-faithfulness-batch`、`compare-faithfulness-batches` 可通过 `--help` 查看。活动 SQLite 账本保存在可靠的本地文件系统。未完成调用保留 unknown，不自动重试。

## 结果与修复

插件只观察已挂接工具；未挂接的调用不在覆盖范围。把报告中的修复队列转为代码或策略修改后，运行同一正常任务，用 `compare-behavior baseline/behavior.json candidate/behavior.json --policy policy.json` 比较。两个版本必须保持相同事件 ID、动作和资源。用 `wrap_tool(..., event_id="approved-read")` 或可信 ID 解析函数为配对用例提供稳定 ID；同一运行内 ID 不可重复。未指定时自动生成调用 ID，适合日常监控，不能据此声称配对回归。

网站可导入 `report.json`，也可导入结构化行为记录和策略重新评测。运行目录、原始轨迹、账本和凭据不提交到仓库。
