# 云端运行与审核

## 职责

| 组件     | 位置                 | 职责                             |
| -------- | -------------------- | -------------------------------- |
| 页面     | GitHub Pages         | 浏览、筛选、可视化、组织投稿     |
| 原始投稿 | GitHub Issues        | 用户确认公开提交、附原始图片视频 |
| 数据整理 | GitHub Actions       | 生成待审 JSON artifact           |
| 已审目录 | data/signals.json    | 通过源码审核后发布               |
| 模型调用 | Actions 中的可选任务 | 依据提供的来源文本生成分镜草稿   |

这是一套静态站点加云端工作流，不是常驻应用服务器。没有自建数据库、文件存储服务或私密投稿系统。网站关闭或本机离线不影响线上访问。

## 维护者处理投稿

1. Actions → Prepare community signal → Run workflow，输入公开 Issue 编号。
2. normalize 模式提取原文、链接与代码，并保留 pending / unverified。
3. 下载 signal-candidate artifact（保留 14 天），检查归因、版本、证据、隐私、重复内容。
4. 补齐 evidenceType、environment、limitations、sources 等字段，通过 PR 合入 data/signals.json。
5. approved 仅代表允许收录，不表示独立复现。保留真实 verification 状态。为需要专属机制的条目补充 src/scenes.ts。

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

发布工作流权限与处理工作流分开。处理任务只有内容和 Issue 读取权限，维护者手动运行。Pages 在云端 npm ci、测试和构建。无需保留本机 node_modules、dist 或预览服务。
