# 交接任务：完成「穿搭」模块主页面 + 校验全站模块主页

> 你（DeepSeek）没有之前的上下文。这份文档自包含：项目是什么、已经做完什么、你要做什么、怎么做、怎么验收。**先通读全文再动手。**

---

## 0. 项目是什么

- 项目名：**执灯人**（LifeFlow 手机端设计蓝本）。这不是生产代码，是一份**像素级 UI 蓝本**，后续会被 1:1 迁移进正式代码库。
- 根目录：`C:\新的开始\Tiimo Mobile UI.design\`
- 手机端蓝本 = `pages/index.html`：**单文件自包含 SPA**（HTML+CSS+JS 全部内联，约 2400 行），一个手机壳里 7 个 screen，底部 4 个 tab。
- 电脑端蓝本 = `pages/desktop.html`：**产品电脑视图**，和手机是两种形式（**不是工作台**）；目前落后一代，正在更新（真实日期/任务/日夜），本轮别顺手改它。
- 工作台 = `workbench/index.html`：**个人工作台**（「LifeFlow 工作台（网页版）」），一天的时间尺度，用户坐下来干活/学习/专注/日记录；不是产品手机/电脑视图，也不是开发工具。三种形式分工见根目录 `README.md`。
- `workbench/cockpit.html`（「执灯人 · 作战台」）是更早的独立清单页，**不是工作台入口**。
- `pages/v3/` 下有 41 个**上一代（v3）模块主页面**：自包含、内联样式、图标用 lucide。它们被 index.html 的 `#screen-mod`（一个 iframe 壳）加载。

### 产品内核（v2.0，已定稿勿改）
- **一天一盏灯，一周一关。** 判定 = 四账户当日差分加权 `D = .30·d体 + .25·d情 + .25·d思 + .20·d志`；`D > +2` 涨一档（+1 光），`D < −8` 缩一档；**单日最多 ±1 光**；等级永不下降。
- 四账户 = 体 / 情 / 思 / 志，对应四域 体能/情感/智识/资源。
- 光曲线：36 级共 **1,062 光**，四段位 拾光(58)/凝露(128)/悬河(276)/鉴台(600)。

### 手机端四屏 IA（刚定稿，**不要动**）
| 位置 | 屏 | 回答的问题 |
|---|---|---|
| tab1 | 待办 | 今天要做什么 |
| tab2 | 日程（screen-today） | 什么时候做 |
| tab3 | 我的（screen-profile） | 我是谁 |
| tab4 | 灯（screen-lamp） | 这一盏灯为什么是现在这个亮度 |
| 头像 | 记一笔（screen-assistant） | 补一笔，灯亮一分 |

---

## 1. 已经做完的（**不要重做**）

本轮任务是「新增穿搭模块 + 恢复模块主页面」。以下已全部落地：

1. ✅ `pages/v3/`（40 页）已从归档 `.workbuddy/_archive/2026-10-08/pages-v3/v3/` 复制回来；`pages/assets/lucide.min.js`（约 397KB）也已就位。
2. ✅ `pages/index.html` 里 `MOD_LINK` 已补全：
   ```js
   const MOD_LINK={
     '睡眠':'v3/sleep.html','饮食':'v3/diet.html','运动':'v3/training.html','休息':'v3/posture.html',
     '饮水':'v3/water.html','吃药':'v3/medication.html','功法养生':'v3/wellness.html','冥想':'v3/wellness.html',
     '情绪记录':'v3/mood.html','记账':'v3/expense.html','长期目标':'v3/goals.html','时间':'v3/schedule.html',
     '备忘录':'v3/notes.html','倒数日':'v3/countdown.html','到点提醒':'v3/reminders.html','更多':'v3/more.html',
     '穿搭':'v3/wardrobe.html'   // ← 这个文件还不存在，你要建
   };
   ```
3. ✅ 日程页模块贴纸的点击已接活（原来是死链只弹 toast）：`document.addEventListener('click')` 里 `.ob-wide .mi` → `openModPage(label,label)`。
4. ✅ `openModPage(mod,label)` 已重写，内部用 `modHit()` 解别名（情绪→情绪记录 / 训练→运动 / 久坐→休息）。
5. ✅ `MOD_META` 已加 `'穿搭':{dom:'资源',info:'衣柜在册 · 换季可筛',pct:.50}`。
6. ✅ 日程页贴纸网格已加「穿搭」贴纸（图标 `#i-cloth`，已存在于 symbol 表），现在共 15 个。
7. ✅ `.ob-wide` 网格从 7 列改为 **5 列**（15 个贴纸 = 3×5，排满）。
8. ✅ `V3_SHELL_CSS`（注入给 iframe 的暗色补丁）已从纯黑 `#000` 换成玄墨调（见下面令牌）。

---

## 2. 你要做的

### 任务 A（主体）：新建 `pages/v3/wardrobe.html` —— 穿搭模块主页

**需求来源（用户原话概括）**：储存自己有哪些穿搭衣服。用户在三个选项里选了「**衣柜单品 + 搭配**」：先录一件件衣服，再从衣柜里挑几件拼成一套；一套可以直接标「今天穿这套」。

**录入字段（用户只勾了「照片」，但纯照片没法筛、没法拼搭配）**，所以做成：
- **照片**（主体，一张一件）
- 名称（一行文本，可留空则自动叫「上衣 3」这类）
- 品类（一行可点选的 chips：上衣 / 下装 / 外套 / 鞋 / 包 / 配饰 / 其他；**不选也能存**，默认「其他」）

不要加季节/场合/颜色等多余字段——用户没要。

#### 数据
- localStorage，key = `zdWardrobe`，结构：
  ```js
  {
    items:   [{ id, name, cat, img, createdAt }],          // img = dataURL
    outfits: [{ id, name, items:[itemId...], lastWorn, wornCount }]
  }
  ```
- **照片必须压缩**：`<input type="file" accept="image/*">` → FileReader → canvas 缩到**最长边 480px** → `toDataURL('image/jpeg', 0.7)`。原图 dataURL 直接存会立刻爆掉 localStorage。
- localStorage 总量上限约 5MB。当 `zdWardrobe` 序列化后超过 **4MB** 时，要 toast/行内提示「衣柜快满了，建议删几件旧照片」并**阻止继续加图**（仍可加无图条目）。

#### 功能清单
1. **顶部统计行**：`N 件 · M 套 · 穿过 X 次`。
2. **衣柜区**：品类筛选 chips（全部 + 7 个品类）→ 照片网格（3 列，方图，底部一条名称 + 品类角标）→ 「+ 添加一件」按钮（拍照/相册）。点开一件：弹出可改名 / 换品类 / 删除。
3. **搭配区**：搭配卡 = 几件单品小图横排 + 搭配名 + 「上次穿：M/D」+ 穿过次数。每张卡上有「今天穿这套」按钮（**同时只能有一套**被标记；再次点击取消）。
4. **拼一套**：进入选择模式，从衣柜里点选 2–5 件 → 起名 → 保存。
5. **空态**：衣柜为空时给一句引导（类似「先拍一件今天穿的」），并直接给一个大按钮。
6. 「今天穿这套」要写 `lastWorn = 今天`、`wornCount+1`，并持久化。

#### 页面形态（**必须遵守 v3 约定**，否则会和其它 39 页长两张脸）
- **做法**：复制 `pages/v3/water.html` 的整个 `<head>`（包含 1023 行的 `<style id="theme-vars">` 和后面的 tailwind browser `<script>` + `<style type="text/tailwindcss">` 块），只把 `<title>` 改成 `穿搭 · LifeFlow`。然后写你自己的 body。
- body 骨架照抄 water.html：`<div class="app-stage"><main class="app">` … `</main></div>`，区块用 `.card`，标签用 `.tag`，进度用 `.progress`，图标用 `<i data-lucide="shirt"></i>` 这种（lucide 脚本在 `../assets/lucide.min.js`，water.html 里已有引入方式）。
- 你自己追加的样式放 body 末尾一个 `<style>` 里，**只用 v3 的 CSS 变量**（`--card / --surface-2 / --text-1 / --text-2 / --text-3 / --border / --brand / --r-lg` …），**禁止硬编码颜色**。
- 暗色：壳（index.html 的 `injectV3()`）加载后会给 `<html>` 设 `data-theme="dark"` 并注入一段覆盖样式，所以你只要全部走变量，深浅两态自动成立。
- **注意**：壳注入的样式会把 v3 页面自带的顶栏/底部导航隐藏（返回和标题由壳提供），所以你的页面主体直接从内容区开始即可，做法对齐 water.html 即可。

### 任务 B：全链路校验脚本

写 `C:\新的开始\Tiimo Mobile UI.design\.workbuddy\tmp\verify_modules.mjs`，并跑通：

- 起静态服务（方法见 §4 环境坑）。
- 打开 `http://127.0.0.1:8899/index.html`，清掉 localStorage 的 `zdLight` 后 reload。
- 进入日程 tab，**逐个点击 15 个贴纸**，对每一个断言：
  - `document.querySelector(".screen.active").id === "screen-mod"`
  - `#modTitle` 文本 = 贴纸名
  - iframe 的 `src` 与 `MOD_LINK` 预期一致
  - 等 iframe load 后：`contentDocument.body.innerText.length > 50`（不是空白页）
  - 全程无 4xx、无 pageerror
- 对「穿搭」额外做行为断言：添加一件（造一个 10×10 的 canvas dataURL 塞进去）→ 刷新仍在 → 拼 2 件成一套 → 标「今天穿」→ 刷新仍在。
- 输出 `N/N PASS`，非零退出码表示失败。

### 任务 C：收尾
- 把 `.workbuddy/tmp/verify_blueprint.mjs`（现有 33 项断言的四屏终检）跑一遍确认没被你改坏；如果它断言的东西因你而变，更新断言而不是绕过。
- 在 `.workbuddy/memory/2026-10-17.md` **追加**（不要覆盖）一段：做了什么、踩了什么坑。
- 如实汇报：哪些过、哪些没过、为什么。

---

## 3. 设计令牌（玄墨调，v3 注入后 iframe 内同样生效）

```
底    --xuan  #0B0F1A     卡  --xuan-2 #121826     深卡 --xuan-3 #1A2332
正文  --mo     #E8EAF2     次级 --mo-2   #9AA3B5    细线 --mo-3 #5A6478
行动色 --brand #4DC3FF 雷光青（v3 注入里映射到 --purple / --goal-blue）
强调  --zhu    #FF3B5C 劫红（完成态/印章，别大面积用）
四象  体能 #FF5C4D · 情感 #C77DFF · 智识 #4DC3FF · 资源 #F5C545
```

**文案禁用词（零容忍）**：加油 / 努力 / 自律 / 坚持 / 失败 / 掌控（评价义）/ AI / 等等，以及旧术语：航线 / 领航 / 今日格子 / 功候 / 心魔 / 渡劫 / 慧宠 / 无相镜。正确用语：记一笔 / 照见 / 灯焰 / 段位 / 周关卡 / 光。

---

## 4. 环境坑（**必读，前人踩过**）

1. **`python -m http.server` 在这台机器上起不来**（进程 LISTENING 但 curl 返回 000）。用 node 单文件服务，监听 `127.0.0.1:8899`：
   ```js
   // 在 pages/ 目录下执行（后台运行）
   const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();
   http.createServer((rq,rs)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
     const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);return rs.end('nf')}
       const t={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
       rs.writeHead(200,{'Content-Type':t});rs.end(d);});}).listen(8899,'127.0.0.1');
   ```
2. **后台命令千万不要接 `| head -N`**：管道读满即关，会把服务进程 SIGPIPE 掉。
3. **playwright-core 不在项目依赖里**，要从这里 require：
   ```js
   import { createRequire } from "node:module";
   const req = createRequire("C:/Users/86189/.workbuddy/binaries/node/workspace/");
   const { chromium } = req("playwright-core");
   ```
   浏览器可执行文件（固定路径）：
   `C:/Users/86189/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe`
4. node 用这个：`C:/Users/86189/.workbuddy/binaries/node/versions/22.22.2-6/node.exe`；python 用 `C:/Users/86189/.workbuddy/binaries/python/versions/3.13.12/python.exe`。
5. **内联 script 语法校验要逐块**：用 `/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g` 循环 + `new Function(块内容)`。不要用非贪婪正则一次匹配整篇（index.html 有多个 script 块，会截断）。
6. **取页面文案用 `textContent`，不要用 `innerText`**（对零布局元素会返回空串）。
7. 改长区块时优先用「行号断言 + 切片拼接」而不是 Edit 工具整段替换，先 `assert` 边界行内容再动手。
8. 路径含中文没问题，但 shell 里引号要成对。

---

## 5. 明确禁止

- 不要动四屏 IA、灯页、我的页、记一笔页（刚定稿）。
- 不要动 `pages/desktop.html`。
- 不要给衣柜加用户没要的字段（季节/场合/颜色/品牌/购买日期…都不要）。
- 不要把照片原图 dataURL 直接入库（必须压缩）。
- 不要在 wardrobe.html 里硬编码颜色。
- 不要删 `.workbuddy/` 目录下的任何东西（归档和脚本都在里面）。
- 完成后不要重写 `MEMORY.md` / 日志，只允许**追加**。

---

## 6. 验收标准（用户会看这些）

1. 日程页 15 个贴纸，每一个点开都真的进入对应 v3 页面（玄墨暗色、无 4xx、无控制台错误）。
2. 「穿搭」贴纸 → wardrobe.html：能加一件带图的衣服、能拼一套、能标「今天穿这套」，刷新后全部还在。
3. 照片被压缩过（单张 dataURL 明显小于原图）。
4. `verify_modules.mjs` 与 `verify_blueprint.mjs` 两个脚本全绿。
5. 禁用词零命中。
