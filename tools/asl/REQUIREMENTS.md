# 运行前提（由代码扫描生成）

> **范围说明：** 本文列出完整实验室的需求；公开包只满足其中与独立核心相关的部分。


本文件回答：**运行这个产品需要什么**（区别于靶子需要什么）。

| 依赖 | 必需性 | 缺失后果 | 引用位置 |
|---|---|---|---|
| Docker CLI + daemon | 可选 | bash 工具不可用 → exec/exfil/运行时各组用例 BLOCKED（不是安全，是测不了） | `engine/asl-bwrap-docker.py`, `plugins/_core.py`… |
| 出网（GitHub 页面） | 可选 | 动态 Issue 拉取不可用 → asl issues 只能读本地快照 | `plugins/issue_compile.py`, `tasks/live_issues.py` |
| 子进程能力 | 必需 | 无法拉起靶子，全部用例 BLOCKED | `engine/asl-bwrap-docker.py`, `engine/atoms.py`… |
| 已安装的 DSH | 必需 | 没有靶子 | `engine/atoms.py`, `engine/planner.py`… |
| urllib（标准库） | 必需 | SB1/F-59 的网络探测不可用 | `plugins/_fixcheck.py`, `plugins/dsh-redteam/hooks.py` |
| sqlite3（标准库） | 必需 | F-59 的清理步骤不可用 | `plugins/dsh-redteam/hooks.py` |

## 检查方式

```bash
python3 asl.py doctor          # 检查环境，说明每项缺失会失去什么
python3 asl.py doctor --install  # 自动修复可修复项（幂等）
```

## 最小可用集

只做离线能力套件（verify / findings / close）时，只需要 python3 + 已安装的 DSH；docker 与出网是**增强项**，缺失会让部分用例 BLOCKED，但不会让结论变成阳性。
