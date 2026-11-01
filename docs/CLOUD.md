# 云端运行与审核

## 职责

| 组件     | 位置                 | 职责                              |
| -------- | -------------------- | --------------------------------- |
| 页面     | GitHub Pages         | 浏览、筛选、可视化、组织投稿      |
| 原始投稿 | GitHub Issues        | 用户确认公开提交、附原始图片视频  |
| 数据整理 | GitHub Actions       | 接收、提示补证、生成候选与草稿 PR |
| 已审目录 | data/signals.json    | 通过源码审核后发布                |
| 模型调用 | Actions 中的可选任务 | 依据提供的来源文本生成分镜草稿    |

这是一套静态站点加云端工作流，不是常驻应用服务器。没有自建数据库、文件存储服务或私密投稿系统。网站关闭或本机离线不影响线上访问。

## 维护者处理投稿

1. 投稿到达后，Receive community signal 生成候选、同源关联建议和补证提示。自动处理不核验事实、不调用模型。
2. Actions → Review community signal → Run workflow，输入 Issue 编号，选择补证、关联、暂不收录、新建档案或更新档案。
3. 新建/更新需要维护者核对来源，填写摘要、环境、局限与判断理由。测试和构建成功后生成独立分支与草稿 PR；若 PR 创建受仓库设置限制，提供 compare 链接。
4. 人工审核差异后合并。合并同步目录状态，Pages 独立部署。原始证据变化则重新审核。
5. Prepare community signal 保留为候选/可选分镜导出入口，artifact 保留 14 天；源材料留在 Issues 中。

具体字段、状态和版本更正流程见 [投稿与维护指南](CONTRIBUTING.md)。approved 仅代表允许收录，不表示独立复现。

## 可选模型接口（尚未配置）

仓库 Variables：ATLAS_MODEL_BASE_URL（HTTPS、通常以 /v1 结尾）、ATLAS_MODEL_ID。
仓库 Secret：ATLAS_MODEL_API_KEY。

storyboard 模式调用兼容的 /chat/completions 接口。未配置时返回 awaiting-model-configuration，不发送请求。接口只接收公开来源的文本摘录，不把钥匙送到浏览器。

当前不会自动抓取任意外部网页，也不执行投稿代码、下载模型或调用被投稿的产品。需要提供可归因的原文摘录；仅有 URL 不足以确认报道内容。来源提取器、媒体识别和网页抓取仍是后续接入点。

模型输出必须为 2–12 个步骤；每步引用已有 sourceIndex，evidence 必须出现在对应摘录中，可记录 loopTo。证据存在检查不能保证推论成立，仍需人工审核。模型不会直接修改发布目录，不会自动发 PR、合并或标记真实事故。

## 投稿材料与边界

输入类型：suspicion、incident、report、attack、defense、resource。
资源类型：text、link、code、repository、image、video、model、product、dataset、api。

浏览器可组织文字、代码、图片和视频；附件预览留在内存中，上传在 GitHub 完成。代码作为文本展示。GitHub 接受的附件种类和大小以其平台限制为准；模型权重和大型视频应提交托管链接。

工作流权限分开：准备任务只读；接收任务可写状态标签、回执和证据检查状态；维护者手动审核任务可创建分支/草稿 PR；发布同步只更新 Issue 状态。Pages 独立构建和部署。所有正文、代码和工作流输入通过 JSON/文件读取，不插入 shell 命令。无需本机常驻预览服务。
