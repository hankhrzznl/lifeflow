# tests · 执灯人富测试

行为级测试（Playwright）与内核/存储纯函数测试。**已入库**，不再依赖 `.workbuddy/tmp`。

## 一条命令

```bash
node tests/run-all.mjs
```

会自己起 `http://127.0.0.1:8899` 静态服务（`pages/`），依次跑：

| 套件 | 覆盖 |
|---|---|
| `verify_blueprint.mjs` | 四屏 IA、任务/灯/关卡/记录、桌面端、语法块 |
| `verify_theme.mjs` | 日夜主题、六入口、iframe 跟随、持久化 |
| `verify_clock_mood.mjs` | 一把时钟、心情日期→tone、非今天只读 |
| `verify_a11y.mjs` | XSS 转义、可访问名、焦点、减少动效、对比度、热区 |
| `verify_p16.mjs` | 桌面同源灯值、schema v2 迁移、导出/导入、多标签 |
| `verify_modules2.mjs` | 睡眠/饮食接灯、AI 球隐藏、四域色、Get Pro、详情关闭 |
| `verify_mood_train.mjs` | 情绪/训练接灯、一套心情 |
| `verify_expense.mjs` | 记账 → 志账户 → 灯 |
| `verify_loop.mjs` | 饮水 → 体账户 → 灯 |
| `verify_sugg.mjs` | 待照见按最弱账户、3 条、dom |
| `verify_gate.mjs` | 周关卡 +2、幂等 |
| `verify_modules.mjs` | 15 个模块页可用、无 4xx |
| `../scripts/test-store.mjs` | store/accounts 纯函数（29） |
| `../scripts/test-light.mjs` | 灯焰内核 51 断言（fixture 在 `tests/fixtures/`） |

## 环境

- 默认 Playwright 在 `C:/Users/86189/.workbuddy/binaries/node/workspace/`，Chromium 在 `ms-playwright/chromium-1223/`；换机器用 `PLAYWRIGHT_PATH` / `CHROME_PATH` 覆盖。
- 服务地址默认 `http://127.0.0.1:8899`，可用 `BASE_URL` 覆盖（`run-all` 会自己起服务）。
- 截图写到 `tests/.artifacts/`，已 gitignore；失败时先看 `pageerrors` 与截图。

## 注意

- 测试里的“今天”全部动态取，不写死日期。
- 模块页加载要等 iframe 的 `LightStore`/主题注入完成（约 3.4s）。
- 任务详情测试要点**带 dom/mod 的任务**（如“拉伸”），点“喝水”只会 toast。
- `tests/_migrate.mjs` 是一次性迁移脚本，保留作记录，不影响运行。
