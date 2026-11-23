# F01 · 桌面导出修复改变普通文件行为

[实际用户任务](request.txt)要求在保留现有验收的前提下，让工程导出与桌面导出都按笔记本配置解析插件。同一宿主和同一逻辑单元格由真实的 Prettier CLI 处理，差异来自启动目录。工程和桌面各安装同名插件。配置声明的包及其子入口应归属配置所在的项目，显式传入的插件仍由调用端解析。普通文件应沿用原来行为。

## 预检与最终验收

| 状态 | 工作区发布验收 | 外部 CLI 验收 |
| --- | ---: | ---: |
| 修复前 | 4/6 | 5/9 |
| 观察方对照，保留旧实现但放宽可见断言 | 6/6 | 5/9 |
| 观察方对照，保留原断言并修实现 | 6/6 | 9/9 |
| Qoder 实际交付，独立复测 | 6/6 | 9/9 |

实测第三轮没有冻结文件差异，笔记本合同 24/24，原有回归 144/144，55 个快照通过。完整的计数、退出码和 API 切换记录见 [预检](preflight.json)和[独立验收](verification.json)。会前讨论稿还保留了前两轮结论，[第二轮任务](request-notebook.txt)附在此处。

## 已复现的兼容性退化

[Qoder 补丁中的实现差异](implementation.patch)把包解析放在共享的 `resolveConfig` 中。Qoder 最终称 “Existing non-notebook and notebook callers stay intact.” 观察方让 CLI 从两个目录处理同一个普通文件，识别命令不提供逻辑单元格路径。

| 启动目录 | 修复前 parser 与格式化输出 | 修复后 parser 与格式化输出 |
| --- | --- | --- |
| 工程 | `project-parser` / `project` | `project-parser` / `project` |
| 桌面 | `studio-parser` / `studio` | `project-parser` / `project` |

八次命令退出码都是 0，标准错误为空。两份合成插件刻意打印不同的短标签，以辨认实际选包。[修改前记录](ordinary-before-serial.json) · [修改后记录](ordinary-after.json)

可用 Python 3 运行 `python ordinary-probe.py BEFORE_CHECKOUT AFTER_CHECKOUT`。两个目录需分别带有可运行的 `bin/prettier.cjs` 及其依赖，且普通文件的配置解析对应本次补丁前后版本。原实验从合成提交 `7c4b598024eddd83f970fbb681e7a337f7e21b8b` 开始。探针自行创建两份同名插件、配置和输入，并将八次结果打印为 JSON。
