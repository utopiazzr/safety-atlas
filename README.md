# Safety Atlas · 越界档案

一个可交互的智能体安全案例观测站。以朱红构成、太空时代轨道、镜面机器人和模拟仪表为视觉语言，让发现、理解和分享安全案例更直观。

网站：https://utopiazzr.github.io/safety-atlas/

## 当前功能

- 点击雷达信号或转动调频旋钮，发现案例。
- 风险频段滑杆、关键词搜索和本机收藏。
- 四步事件回放：播放、暂停、拖动进度、查看防御建议、复制案例链接。
- 三步投稿：记录发现 → 补充依据 → 预览后前往 GitHub 确认公开提交。
- 可选本机草稿与 JSON 下载；手机布局、键盘操作、减少动态效果支持。

目前四个案例均为原创教学示意，不代表已核验的真实事故。防御视角展示可能的干预措施，不代表实测结果。

## 本地运行

需要 Node.js 22.13+。

```sh
npm ci
npm run dev
npm test
npm run build
```

默认投稿目标为 `utopiazzr/safety-atlas`。Fork 后可设置 `VITE_GITHUB_REPOSITORY=owner/repository`；Pages 工作流会自动使用当前仓库。

## GitHub Pages

仓库 Settings → Pages → Source 选择 **GitHub Actions**。推送到 `main` 后，`.github/workflows/pages.yml` 自动测试、构建和发布。首次启用托管后，若此前运行失败，可在 Actions 中重新运行。

这是静态 React + TypeScript + Vite 网站，使用相对资源路径，支持 `/safety-atlas/` 子路径部署。没有服务端数据库、账户系统或私有投稿接口。

## 参与社区

网站表单会生成带标题和正文的 GitHub Issue 链接。用户在 GitHub 最后确认提交；未登录者先登录。较长材料可以下载 JSON 后手动附到 Issue。也可以直接使用仓库的案例 Issue 模板。

提交不会自动变成网站上的已核验案例。维护者检查公开证据、去重和脱敏后，通过 PR 更新 `src/cases.ts`。未来可逐步增加真实案例、攻击/防御方法库和审核工具。

请勿公开访问令牌、私人日志或个人隐私。未公开漏洞应先通过受影响项目的私密披露渠道处理。

收藏只保存案例 ID。本机草稿仅在用户点击保存时写入浏览器；它没有加密，公共设备请及时清除。页面不把表单发送到自己的服务器，也不集成分析追踪。

## 视觉资源

主视觉为 AI 生成的原创机器人插画，来源及完整生成提示见 [docs/ASSETS.md](docs/ASSETS.md)。图标使用 Lucide，插画示意图和交互动画由 SVG/CSS 实现。

## 验证

`npm test` 验证投稿 URL 的编码、仓库目标限制和长材料完整性。发布前另在 Edge 中验证了雷达、捕获、回放、防御切换、筛选、收藏持久化、投稿确认、草稿下载，以及 390px/320px 手机布局。
