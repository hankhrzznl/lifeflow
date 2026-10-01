# ① · 关掉 Vercel 部署保护，让站点能公开访问

> 来源：LifeFlow v7 待办清单 ｜ 生成 2026-10-01
> **直接整段复制下面的代码块发给执行的智能体即可。**
> 项目标识与实测证据见：`待办三处-执行提示词.md` 的「共用事实」一节（如执行者需要更多上下文请一并附上）。


```
【任务】把一个 Vercel 项目的「部署保护」关掉，使生产站点可公开访问。

【背景】
项目 lifeflow 每次推送都构建成功（连续 6 次 Production success），
但访问任何地址都被拦：

  GET https://lifeflow-hankhrzznls-projects.vercel.app
  → HTTP/1.1 302 Found
  → Location: https://vercel.com/sso-api?url=...&nonce=...
  → Set-Cookie: _vercel_sso_nonce=...
  → 正文: "Protected by Vercel Authentication"

注意：连"部署成功的生产域名"也被拦，说明这是**项目级**的
Deployment Protection（Vercel Authentication），不是单个部署的问题。

【目标状态】
不带任何登录态访问该项目的生产地址，返回 **HTTP 200** 且正文是应用内容
（应含中文「此刻」「刚过去」「往后」「工具」「记一笔」），
**不再出现 302 跳 vercel.com/sso-api，也不再出现 "Protected by Vercel Authentication"**。

【项目标识】
- 团队 slug : hankhrzznls-projects
- 项目名    : lifeflow
- 面板地址  : https://vercel.com/hankhrzznls-projects/lifeflow/settings/deployment-protection

⚠ projectId 我没有实测到，**不要照抄任何 prj_ 开头的猜测值**。
  面板与 API 都能只用上面两个 slug。确实需要 projectId 就先查：
  curl.exe "https://api.vercel.com/v9/projects/lifeflow?teamId=<TEAM_ID>&slug=lifeflow" -H "Authorization: Bearer <VERCEL_TOKEN>"

【步骤 · 有令牌就走 API（推荐，无需人点面板）】
（下面是 PowerShell 写法。若用 cmd/bash，写成一行、去掉行尾的反引号即可。）

# 先拿 teamId（后面要用）
curl.exe "https://api.vercel.com/v2/teams?slug=hankhrzznls-projects" -H "Authorization: Bearer <VERCEL_TOKEN>"
# 响应里的 "id" 字段就是 <TEAM_ID>

# 关掉 Vercel Authentication（设为 null = 关闭）
curl.exe -X PATCH "https://api.vercel.com/v9/projects/lifeflow?teamId=<TEAM_ID>&slug=lifeflow" `
  -H "Authorization: Bearer <VERCEL_TOKEN>" `
  -H "Content-Type: application/json" `
  -d '{\"ssoProtection\":null}'

# 确认当前设置
curl.exe "https://api.vercel.com/v9/projects/lifeflow?teamId=<TEAM_ID>&slug=lifeflow" `
  -H "Authorization: Bearer <VERCEL_TOKEN>"
# 期望：响应里 ssoProtection 为 null

【步骤 · 没有令牌就点面板（3 步）】
1. 打开 https://vercel.com/hankhrzznls-projects/lifeflow/settings/deployment-protection
2. 把 「Vercel Authentication」改为 **Disabled**
   （若想保留一点保护，可选 "Standard Protection" —— 只保护 Preview、放开 Production）
3. Save

【验收（必须自己跑，用输出证明）】
curl.exe -s -o NUL -w "HTTP=%{http_code}\n" --max-time 20 https://lifeflow-hankhrzznls-projects.vercel.app
curl.exe -s --max-time 20 https://lifeflow-hankhrzznls-projects.vercel.app | Select-String -Pattern "此刻|刚过去|往后|工具"

期望：HTTP=200，且能搜到上述中文。
如果仍是 302，请再确认一次面板设置（Vercel 有已报告的"设为 Disabled 仍拦截"行为），
并确认你访问的是**稳定域名**（lifeflow-hankhrzznls-projects.vercel.app），
不是带哈希的不可变快照（lifeflow-<hash>-...vercel.app）。

【不要做】
- 不要改代码、不要动 Git、不要重新部署（站点是好的，只是被拦住）
- 不要删除项目或部署记录
```
