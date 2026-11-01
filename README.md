# Safety Atlas · 越界档案

[在线观测站](https://utopiazzr.github.io/safety-atlas/) · 人类掌舵，发现威胁，共建防线。

一个以复古科幻视觉呈现智能体安全案例、攻击研究、防御方案和生态资源的社区项目。GitHub Pages 托管页面，GitHub Issues 接收投稿，GitHub Actions 处理与构建；日常使用不需要本机服务器。

## 现在可以做什么

- 浏览九个有公开来源的案例、论文、工具或模型；筛选、搜索、收藏。
- 点击科幻海报，播放不同长度的机制示意；查看来源、版本、运行条件、局限和相关资源。
- 用一句怀疑、链接、代码或文件开始投稿；分类和其他信息可选。
- 图片、视频可在浏览器预览，原文件仍需在 GitHub 附上。网站不代替用户公开发布。
- 中英文界面、移动端布局、键盘操作、减少动态效果。
- 维护者可在云端把公开 Issue 整理成待审候选；兼容模型的分镜接口已预留。

**来源可追溯不等于本站独立复现。** 当前条目的 verification 为 source-linked；研究 PoC、厂商通告、模型卡与真实事故分别描述。插画是艺术隐喻，过程动画是基于来源的机制示意。

## 云端维护

编辑源码或数据并推送 main 后，Pages 工作流测试、构建和发布。Settings → Pages → Source 使用 GitHub Actions。

社区提交在 GitHub 最后确认，维护者审核后通过 PR 更新 data/signals.json；机制场景位于 src/scenes.ts。不要直接把未经核验的投稿设为 verified。详见 [云端流程](docs/CLOUD.md) 与 [真实资料兼容性调研](docs/RESEARCH.md)。

模型服务尚未配置，当前不会调用付费模型。未来只需在仓库配置 Variables ATLAS_MODEL_BASE_URL、ATLAS_MODEL_ID 和 Secret ATLAS_MODEL_API_KEY。密钥不进入网页。

## 开发与验证

需要 Node.js 22.13+。运行 npm ci、npm run dev；npm test 校验投稿和数据流程，npm run build 检查 TypeScript 并构建。无需本机常驻服务或下载模型权重。默认投稿仓库是 utopiazzr/safety-atlas，Fork 可设置 VITE_GITHUB_REPOSITORY；Pages 构建自动使用当前仓库。

浏览器验证覆盖搜索、筛选、分步回放、链接与代码单独投稿、图片/视频/文本文件预览、移除和导出、语言持久化、390px/320px 布局。不会通过测试发布真实 Issue。

收藏仅在浏览器保存 ID；文字草稿仅在主动保存时写入浏览器。表单文件不自动上传。较长投稿可复制全文或导出 JSON，再到 GitHub 完成。未公开漏洞请通过受影响项目的私密渠道披露。

## 设计与资源

故事线：人机共处的未来 → 发现异常 → 理解边界 → 连接防御与社区。

以深空和镜面机器人承接科幻感，以朱红构成、暖白标题条、机械刻度和半调网点保留复古漫画的平面感。设计依据见 [视觉研究](docs/DESIGN.md)，生成插画的工具与完整提示见 [资源记录](docs/ASSETS.md)。
