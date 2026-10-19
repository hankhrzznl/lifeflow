# 执灯人 / LifeFlow 蓝本

三种形式，按「时间尺度」分工，不是同一种界面的三个皮肤。

| 形式 | 入口 | 时间尺度 | 认知模式 | 谁用 |
|---|---|---|---|---|
| **手机端** | `pages/index.html` | 当下（moment） | 采集 / 执行 | 用户·随身 |
| **工作台** | `workbench/index.html` | 一天（day） | 干活 / 学习 / 专注 | 用户·桌面 |
| **电脑端网页** | `pages/desktop.html` | 一周 / 一月 | 规划 / 复盘 | 用户·桌面 |

## 任务 → 主责端

| 任务 | 频率 | 会话 | 主责 | 次责（只读/简版） |
|---|---|---|---|---|
| 记饮水/睡眠/饮食/训练/情绪/记账 | 天天多次 | 5–30 秒 | **手机** | — |
| 勾任务、执行当天计划 | 天天 | 5 秒 | **手机** | 工作台（当天任务） |
| 瞥灯、看心情 | 天天 | 2 秒 | **手机** | 电脑端 |
| 排今天的深度工作/学习 | 天天 | 5–20 分钟 | **工作台** | — |
| 计时/专注/学习课时 | 天天 | 25–90 分钟 | **工作台** | — |
| 日记录、日记、当日复盘 | 天天 | 5–15 分钟 | **工作台** | — |
| 排下周计划 | 一周 | 15–30 分钟 | **电脑端** | 手机只读「本周计划」 |
| 周/月复盘、看趋势 | 一周/月 | 15–30 分钟 | **电脑端** | — |
| 定目标/预算 | 一周/月 | 10–20 分钟 | **电脑端** | — |
| 批量改任务、重排日程 | 偶尔 | 10–20 分钟 | **电脑端** | — |

## 数据流（单写者）

- **手机写**：`zdLight.logs` / `moods`、`lifeflow-days-v1`（事实）。
- **工作台写**：`wb_lifeflow_daywork_v2`（个人工作/学习/日记录）；只读 `zdLight`。
- **电脑端写**：`zdLight.plan` / `todos`（意图）；目标/预算不写（归手机端）；只读日志。
- 每个数据域只有一个写者；其余端只读镜像，不双写。

## 边界

- **手机 ≠ 工作台**：手机是「路上记一笔」，工作台是「坐下来干一天」。
- **工作台 ≠ 电脑端**：工作台是「今天干什么」，电脑端是「这周怎么排」。
- **电脑端 ≠ 手机**：电脑端是规划/复盘，手机是采集/执行。
- 三者都不做开发工具/控制台/JSON 检查——那是智能体的事。

## 当前状态（2026-10-18）

- **手机端**：v3 + 日夜 + 四账户 + 模块中枢 + 六模块接灯；「本周计划」只读入口（`#openWeek`）。设计正源。
- **工作台**：`workbench/index.html`「执灯人 · 个人工作台」，`wb_lifeflow_daywork_v2` 独立数据；导航 **今日 / 模块 / 账本 / 日复盘**（只做一天，不做周复盘）；品牌/日夜已同源（`lifeflow-theme`），左栏只读手机灯/心情，今日与日复盘都只读电脑端「今日计划」，时间轴有「此刻」，模块/账本/复盘日夜可读，键盘有焦点环。`cockpit.html` 是更早的独立清单页，不是工作台入口。
- **电脑端网页**：真实日期/周/月（`new Date`），读手机 `zdLight.plan/todos` 并写回，`tiimoClone` 只做兜底；日夜与手机共用 key；周视图可点进某天、可拖墨点换天；月视图 42 格 + 汇总；顶栏跟随选中日。导航只留 **日/周/月 + 成长（境印）**——「方向」「四域」属手机端产品模型，电脑端不再重复。
- **共享层**：`pages/core/light.js` 三端共用；`pages/tokens.css` 收两端逐值相同的令牌（`--xuan/--mo/--line/--brand/四域/--zhu`），`--hi/--am` 等语义不同者不抽。

## 更新顺序（保持分工）

1. ✅ **电脑端 → 规划/复盘台**：真实日期/周；读手机 `zdLight` 日志，写 `zdLight.plan/todos`；`tiimoClone` 只做迁移；日夜；周视图点击/拖拽。
2. ✅ **工作台 → 个人工作台**：保留一日工作台/学习/专注/日记录；品牌/日夜跟上；读 `zdLight` 只读；不是开发工具。
3. ✅ **手机端 → 采集/执行**：「本周计划」只读入口（`#openWeek`），不搬规划编辑。
4. ✅ **文档/测试**：`run-all` **17 套件**（含 landing 6、plan 29、workbench 17）；电脑写计划 → 手机读到 → 工作台只读整条回路有行为测试；`scripts/verify` 31。

## 跑起来

```bash
python -m http.server 8899
# 入口（三个形式）  http://127.0.0.1:8899/
# 手机端   http://127.0.0.1:8899/pages/index.html
# 工作台   http://127.0.0.1:8899/workbench/index.html
# 电脑端   http://127.0.0.1:8899/pages/desktop.html
```

## 测试

```bash
node scripts/verify.mjs        # 零依赖：语法/结构/静态 31 条
node tests/run-all.mjs         # 富测试 17 套件（Playwright；240s/套超时）
node scripts/test-store.mjs    # store/accounts 纯函数
node scripts/test-light.mjs    # 灯焰内核 51 条
```

## 部署（GitHub Pages）

仓库自带 `.github/workflows/pages.yml`：推到 `master` 后自动把 **落地页 + `pages/` + `workbench/`** 发布到 Pages（不发布 `.workbuddy/`、`资料库备份/`、`_sync/`、`tests/`、`docs/`、`.design/`）。

第一次部署（需要你本机有仓库地址和凭据；这个会话里没有配置 remote，也没装 `gh`）：

```bash
git remote add origin https://github.com/<你>/<repo>.git
git push -u origin master
# GitHub → Settings → Pages → Build and deployment → Source: GitHub Actions
# 等 Actions 里 Deploy to GitHub Pages 跑完，地址是 https://<你>.github.io/<repo>/
```

部署后的注意点：

- 入口是根 `index.html`（三个形式的选择页）；三端资源、`manifest.json`、`sw.js` 都是相对路径，子路径部署已验证。
- 数据只存在**访问者自己的浏览器**里（localStorage），不联网、不上传；首次打开是空白/演示数据。
- HTTPS 下 Service Worker 生效（网络优先、离线回退），改版后刷新即可拿到新版。

## 数据

| key | 内容 | 写者 |
|---|---|---|
| `zdLight` | 灯/心情/日志（v2） | 手机（logs/moods）+ 电脑端（plan/todos） |
| `lifeflow-days-v1` | 模块记录（store） | 手机 |
| `zdWardrobe` | 衣柜 | 手机 |
| `lifeflow-theme` | 日夜主题 | 手机 / 电脑端 |
| `tiimoClone` | 电脑端旧任务板 | 电脑端（仅迁移兜底） |
| `wb_lifeflow_daywork_v2` | 工作台个人工作/学习/记录 | 工作台 |

## 结构

- `pages/index.html` 手机端壳（无构建，单文件 + `core/*.js`）
- `pages/v3/` 41 个自包含模块页
- `pages/core/light.js` 灯焰内核（唯一实现，手机端/电脑端/测试共用）
- `pages/core/store.js` + `accounts.js` 模块记录与四账户
- `pages/desktop.html` 电脑端网页（规划/复盘台）
- `workbench/index.html` 个人工作台；`workbench/cockpit.html` 更早的作战台（历史参考）
- `tests/` 富测试（Playwright），`scripts/` 零依赖校验
