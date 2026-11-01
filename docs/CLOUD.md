# 云端运行与审核

## 系统分工

GitHub Pages 保留公共网站。Sites Worker 接收匿名投稿，D1 存状态和限额，私有 R2 存文件片段。网站直接调用接收服务；提交人不需要 GitHub 账户。服务端源码见 ../cloud/README.md。

## 私密线索的负责人流程（公开提案见共同维护指南）

1. 打开 https://safety-atlas-intake.aurora-scarf-6347.chatgpt.site/admin ，使用所属 Sites 账户登录。
2. 审阅材料。可要求补证、暂不收录，或填写可以公开的标题、摘要、来源、证据类型、条件、局限与理由。原始附件不自动公开。
3. Cloud intake bridge 每小时尝试导入已审核摘要；也可手动运行。任务用 GitHub OIDC 认证，无需 PAT。公开 Issue 是候选材料，不等于网站已收录。GitHub 定时任务可能延迟，长期无仓库活动也可能被暂停，请检查 Actions 状态。
4. 对公开 Issue 手动运行 Receive community signal，或添加 atlas:triage 标签，得到关联建议与补证检查。任意公开评论、编辑不再触发接收任务。
5. 已同步的摘要可添加 atlas:propose 标签，复用字段生成草稿 PR；需要修改字段时用 Review community signal。人工核对差异后合并，Pages 自动部署。
6. 若原始材料或公开 Issue 后续发生变化，重新审核；证据快照不匹配时不要合并旧提案。

## 上传、回执与保留

单文件 512 MiB，单次 1 GiB / 100 文件；8 MiB 分片。不完整上传 24 小时后可清理，完成后的原始材料保留 30 天。用户下载回执即可恢复上传、查看状态、补充说明和撤回待审内容。回执不能分享；丢失后没有免认证恢复入口。

全站每日最多 100 份、每客户端 5 份；保留材料总计 10 GiB。Cloud intake bridge 每次清理最多 25 份过期材料；摘要已审核的记录只删除原始材料，保留公开摘要和引用地址。检查 Actions 失败状态与云端容量，避免清理中断。系统不保证无限存储。

大项目优先保留仓库、Release、模型页链接、固定版本和重点路径。必要附件可以打包上传，系统不解压包内容。不得上传密钥和个人隐私；管理员下载潜在危险代码时使用隔离环境。

## 部署与权限

前端配置在 src/cloud-client.mjs。后端 server secrets：INTAKE_SECRET、ALTCHA_KEY_SECRET、ADMIN_EMAIL；其他环境：ALLOWED_ORIGINS、GITHUB_REPOSITORY、GITHUB_REPOSITORY_ID、OIDC_AUDIENCE。密钥在 Sites 服务端环境中配置，不能进入源码。

Fork 必须创建自己的接收服务，替换 cloud/.openai/hosting.json 的项目绑定与前端 API 地址，并配置实际仓库 ID、来源域名、OIDC audience。现有服务只接收原站来源。更换域名还需更新 CORS 和自动化身份。

后台仅适用于 Sites 可信身份网关。GitHub Pages 不能运行后端，不能把任何 GitHub 写入 token 放入网页。

## 可选模型服务（尚未配置）

仓库 Variables：ATLAS_MODEL_BASE_URL（HTTPS、通常以 /v1 结尾）、ATLAS_MODEL_ID；Secret：ATLAS_MODEL_API_KEY。storyboard 模式使用兼容 /chat/completions 的接口。未配置不发送请求。

仅给模型提供经确认可公开的来源摘录；不自动获取任意 URL、不执行项目、不下载权重。分镜必须引用已有来源，输出只能是草稿，由人审核后进入目录。


## Community proposals

Opt-in public proposals now bypass the private owner-review queue. The separate `community` envelope requires `publicConsent: true`; raw notes, code, file paths, attachments and receipt secrets are never included in it. `GET /api/community` lists the latest 30 proposals. New migration `0001_community` preserves legacy private submissions. Do not edit the applied initial migration.

The hourly OIDC bridge imports both explicit public proposals and owner-curated summaries. It acknowledges an immutable public snapshot. GitHub collaborators use `atlas:propose` or Curate public proposal to generate a draft PR without retyping fields. Automation never merges. The private desk prioritizes unresolved private material and can hide public proposals with an audit reason; already exported GitHub content must be moderated there too.
