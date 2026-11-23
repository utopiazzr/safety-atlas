# AI 代码审查清单

七个真实案例导出的七条检查。每条都有具体命令，不用懂原理也能执行。

用之前先记住一件事：**这七条都不是「代码写得烂」，是「代码写得对，但少了一件事」。**
所以靠读代码看不出来，得靠查。

---

## 1. 每条按 id 取记录的接口，查询里有没有当前用户？

**对应案例：`lovable-bola-2026`** —— 改一个 URL 里的数字就能读别人的项目，存活 48 天。

```js
// 有问题
db.project.findUnique({ where: { id } })

// 正确
db.project.findFirst({ where: { id, ownerId: user.id } })
```

**怎么查**：搜所有 `findUnique` / `findById` / `get(...id)` / `WHERE id = ?`。
每一条都问：这个查询限定了当前用户/租户吗？

**注意**：「登录了」不等于「有权看这条」。认证做了，授权漏了。

---

## 2. 数据库表的行级权限开了吗？策略是真过滤还是 `using (true)`？

**对应案例：`lovable-supabase-rls-2025`（303 个端点）、`using-true-policy-trap`**

```sql
-- Supabase / Postgres：哪些表根本没锁
select tablename from pg_tables
where schemaname = 'public' and not rowsecurity;

-- 哪些策略是空转的
select tablename, policyname, qual from pg_policies
where schemaname = 'public';
```

**看 `qual` 那一列。** 如果是 `true`，或者只检查 `auth.uid() is not null`，
那等于没设防——因为只要能注册，「已登录」就等于「任何人」。

---

## 3. 权限最大的那个凭据，有没有出现在前端代码里？

**对应案例：`service-role-key-in-client`**

```sh
# 前端能看到的包里搜服务端密钥
grep -rn "service_role\|SERVICE_ROLE\|admin_key\|sk_live" \
  --include="*.js" --include="*.ts" --include="*.tsx" src/ public/ dist/ 2>/dev/null
```

Supabase 的 `service_role` key **绕过所有 RLS**。它出现在客户端 bundle 里，
等于把「绕过全部访问控制」的通行证公开发放。

**为什么 AI 会这么干**：为了让查询「跑通」，它选权限最大的方案。

---

## 4. 界面上隐藏了按钮，后端接口也校验了吗？

**对应案例：`client-side-role-check`（CWE-602）**

```js
// 前端：只是不显示，不是不让你调
{user.isAdmin && <DeleteButton />}
```

**怎么查**：找到每一个「只有管理员能做的事」，然后**直接调那个接口**（用普通账号）。
能成功就是有这个洞。

前端那行 `if` 看起来像权限检查，但它只是显示逻辑。

---

## 5. 密码哈希用的是不是快速算法？字段长度有没有逼着它降级？

**对应案例：`silent-hash-weakening`**

```sh
grep -rnE '\b(md5|sha1)(sum)?\b' --include='*.py' --include='*.sh' --include='*.js' .
```

**还要查一件更隐蔽的事**：有没有 `sha256(...)[:32]` 这种截断？
截断到 128 位虽然还在强哈希族里，但强度减半，而且掩盖了「字段设计不对」这个真问题。

**正确做法**：字段加宽，用 bcrypt / argon2 / scrypt。

---

## 6. 这一段改动，有没有哪个部分不产生可见结果？

**这一条是前五条的共同根源。**

七个案例里六个有同一个结构：

| 案例 | 不产生可见结果的那一步 |
|---|---|
| RLS | 表锁没锁，演示界面一模一样 |
| BOLA | 有没有归属过滤，正常请求看不出 |
| `using (true)` | 策略存在，表结构看起来一样 |
| service_role key | 前端功能完全正常 |
| 前端权限 | 按钮该隐藏的确实隐藏了 |
| 密码哈希 | md5 和 sha256 截断，测试都是绿的 |

**审查的时候专门找这一类**：这段改动里，哪一部分出了问题也不会报错、不会让界面变样、
不会让测试变红？

那部分就是要重点看的。

---

## 7. 需求里没写「安全」两个字的地方，AI 补了吗？

**对应案例：全部七个**

| 需求原文 | 没说出口的那半 |
|---|---|
| 「只有管理员能看到这个按钮」 | 后端也要校验 |
| 「按 id 取这个项目」 | 只取自己的 |
| 「结果要 32 个字符」 | 用安全的方式产出 32 个字符 |
| 「建一个 profiles 表」 | 开 RLS |

**AI 会把说的那半做完，没说的那半不动。**

这不是它偷懒，是它按字面办事。所以**写需求的时候，把安全那半也写进去**；
或者**审查的时候，专门补那半**。

---

## 附：这个工具的定位

上面七条是**人**能查的。

`asl` 只自动化其中第 5 条的一部分——量出「AI 在这一类任务上有多少概率走弱的那条路」，
带区间、可复现、能进 CI。

其余六条目前只能靠人或别的工具。我们不假装能测。

所以：

- 想要一个数字量化风险 → 用 `asl`
- 想真的挡住 → 用这份清单 + 你的审查流程

---

## 出处

每个案例的技术细节、来源链接、可信度标记，都在 [`cases/cases.json`](cases/cases.json)。
`python3 cases/validate.py` 可以校验库的完整性。

## 8. 无权时是不是造了个空对象

**症状：** 访问检查失败的分支里，返回的不是 `None`、不是异常，而是新建的空对象。

```python
# 危险：调用方无法区分「空」和「无权」
if p.owner_id != user_id:
    return Project(id=p.id, owner_id="", name="")
```

**为什么危险：** 没有异常、没有 None、没有日志。调用方拿到对象就按有权限继续走。
扫描器看不到——代码里连可疑字符串都没有。

**实测：** 在施加「必须返回对象」压力时，18 次运行里出现 6 次。
无压力时 20 次里只有 1 次。

**怎么查：**

```sh
# 在权限判断附近找兜底构造
grep -n -A3 -E '(owner|tenant|user)_id *!=|raise .*Denied|not .*allowed' --include=*.py -r . \
  | grep -E 'return (Project|User|Order|Document)\(|return \{\}'
```
