# 非攻击性越权案例库

## 这个库收什么

**不需要攻击者技巧就能触达的访问控制失效。**

不是「有人精心构造了 payload」，而是「少写了一条策略」「默认值就是公开的」
「为了跑通用了权限最大的凭据」。

判据三条，缺一不可：

1. 缺一个检查、一个默认值、一条策略就足以造成暴露
2. 不需要构造 payload、不需要绕过检测、不需要社工
3. 有可核验的公开来源

## 为什么不收提示注入

EchoLeak 那类零点击提示注入很严重，但它需要精心构造的输入，属于**攻击面**，
不属于这个库。混在一起会让「不需要技巧」这个边界变模糊。

## 字段说明

| 字段 | 说明 |
|---|---|
| `category` | 缺授权 / 默认公开 / 权限过宽 / 租户隔离 / 信任客户端 / 静默削弱 |
| `why_non_adversarial` | **最重要的一栏**：说清为什么不需要攻击者 |
| `mechanism` | 技术上到底缺了什么 |
| `detectability` | 正常人能不能看出来，演示时是否可发现 |
| `confidence` | `verified` / `reported` / `disputed` / `measured-here` |
| `sources` | 至少一条，带类型 |

## confidence 的含义

| 值 | 意思 |
|---|---|
| `verified` | 我读过一手材料，机制确定 |
| `reported` | 有公开研究报告，我没独立核实每个数字 |
| `disputed` | 官方记录本身有争议（比如厂商不认责） |
| `measured-here` | 我们自己实测的数据，原始记录在 `runs/` |

**不要把 `reported` 当 `verified` 用。** 这个区别就是整个库可信度的来源。

## 现在有什么

| id | 类别 | 可信度 |
|---|---|---|
| `lovable-supabase-rls-2025` | 缺授权 | disputed |
| `lovable-bola-2026` | 缺授权（BOLA） | reported |
| `lovable-mass-leak-2026` | 缺授权 | reported |
| `using-true-policy-trap` | 默认公开 | verified |
| `service-role-key-in-client` | 权限过宽 | verified |
| `client-side-role-check` | 信任客户端 | verified |
| `silent-hash-weakening` | 静默削弱 | measured-here |

七个案例，六种不同的失效方式，但它们长得很像。

## 一条贯穿全部的观察

七个案例里，六个有同一个结构：

> **出问题的那一步，是整个流程里唯一不产生可见结果的一步。**

RLS 开不开，演示界面一模一样。密码哈希用 md5 还是 sha256，测试都是绿的。
`using (true)` 和真正的策略，表结构看起来一样。

所以这不是「AI 不小心」。这是**优化目标里没有它**——AI 优化「能跑」，安全边界不在目标函数里。

## 三种最常见的说法，本质是同一件事

| 用户说的 | AI 理解的 | 少了什么 |
|---|---|---|
| 「只有管理员能看到这个按钮」 | 前端 `if (isAdmin)` | 后端校验 |
| 「按 id 取这个项目」 | `where: { id }` | `where: { id, ownerId }` |
| 「结果要 32 个字符」 | 挑一个能产出 32 位的工具 | 「用安全的方式产出」 |

三句话都只说了一半。AI 把说的那半做完，没说的那半不动。

**这不是提示词写得不好。是「安全」从来不在需求里，只在人的默认认知里。**

## 怎么加一条

1. 在 `cases.json` 的 `cases` 数组加一项
2. 跑 `python3 cases/validate.py`
3. 至少给一条来源，写清 `confidence`

别为了凑数加案例。**五个扎实的比五十个传闻有用。**

## 这份库能变成什么

七个案例导出成一份可执行的审查清单：[`../CHECKLIST.md`](../CHECKLIST.md)。
每条都带命令，不用懂原理也能跑。
