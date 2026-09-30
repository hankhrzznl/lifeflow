/**
 * 播种数据 —— 让成品开箱就有内容可看
 *
 * 口径来源：线框里用的那组例子（睡稳 7h / 喝水 2000ml / 快走 / 专注格 / 备考期）
 * 公理 A1：所有东西都落成 rules + entries 两张表
 *
 * ⚠ 只播种一次（ensureSeed 检查 rules 是否为空）
 */

import {
  db,
  type RuleDoc,
  type EntryDoc,
  type ProposalDoc,
  type ToolViewDoc,
  addDays,
  todayDate,
} from "./db";
import { insertMany } from "./write";

const T = todayDate();

/* ── 规则 ─────────────────────────────────────────────────── */
function rules(): RuleDoc[] {
  const base = { state: "growing" as const, updatedAt: Date.now() };
  return [
    {
      id: "r-sleep", title: "睡稳", kind: "rule", home: "身体",
      target: 7, unit: "小时", cadence: "daily",
      ...base, order: 1,
    },
    {
      id: "r-water", title: "喝水", kind: "rule", home: "身体",
      target: 2000, unit: "ml", cadence: "daily",
      ...base, order: 2,
    },
    {
      id: "r-walk", title: "快走", kind: "rule", home: "身体",
      target: 40, unit: "分钟", cadence: "weekly", perWeek: 4,
      ...base, order: 3,
    },
    {
      id: "r-focus", title: "专注格", kind: "rule", home: "头脑",
      target: 1, unit: "格", cadence: "daily",
      ...base, order: 4,
    },
    {
      id: "r-study", title: "学习目标", kind: "linear", home: "成长",
      target: 1, unit: "小时", cadence: "daily",
      start: addDays(T, -90), end: addDays(T, 96),
      ...base, order: 5,
    },
    {
      id: "r-med", title: "用药", kind: "rule", home: "身体",
      target: 2, unit: "次", cadence: "daily",
      state: "paused", updatedAt: Date.now(), order: 6,
    },
    {
      id: "r-posture", title: "体态", kind: "rule", home: "身体",
      target: 8, unit: "次", cadence: "daily",
      ...base, order: 7,
    },
    {
      id: "r-mood", title: "情绪记录", kind: "rule", home: "情绪",
      cadence: "daily",
      ...base, order: 8,
    },
    /* ── 多因素目标（A5）：时期，只存引用、不拥有 ── */
    {
      id: "p-exam", title: "备考期", kind: "period", home: "成长",
      start: addDays(T, -44), end: addDays(T, 50),
      mentions: ["r-sleep", "r-focus", "r-study"],
      tempTargets: { "r-sleep": 6.5 },
      periodGoal: "把证考过",
      state: "growing", updatedAt: Date.now(), order: 100,
    },
    /* ── 设定（不进三组）── */
    {
      id: "s-reminders", title: "提醒", kind: "setting", home: "跨域",
      tags: ["setting"],
      state: "growing", updatedAt: Date.now(), order: 200,
    },
  ];
}

/* ── 流 ───────────────────────────────────────────────────── */
function entries(): EntryDoc[] {
  const out: EntryDoc[] = [];
  let n = 0;
  const push = (e: Omit<EntryDoc, "id" | "createdAt">) => {
    out.push({ ...e, id: `e${++n}`, createdAt: Date.now() - n * 1000 });
  };

  for (let i = 44; i >= 0; i--) {
    const date = addDays(T, -i);
    // 越近的日子越差 —— 复刻线框里"近两周在变坏"
    const late = i <= 13;
    const recent = i <= 5;

    /* 睡眠：入睡 + 时长 */
    const inH = late ? 24 + (i <= 5 ? 1 : 0) : 23;
    const inM = late ? 10 + ((i * 7) % 40) : 10 + ((i * 3) % 30);
    const inTime = `${String(inH % 24).padStart(2, "0")}:${String(inM).padStart(2, "0")}`;
    push({
      at: `${date}T07:${String(10 + (i % 20)).padStart(2, "0")}`,
      date, ruleId: "r-sleep", text: "起床",
      value: 7, unit: "小时",
      tags: ["睡眠"],
    });
    // 睡够没够用一条"入睡"的流表达时长
    const sleepHours = late ? 6.4 + ((i * 3) % 5) / 10 : 7.1 + ((i * 3) % 6) / 10;
    push({
      at: `${date}T${inTime}`, date, ruleId: "r-sleep",
      text: `入睡 ${inTime}`, value: Number(sleepHours.toFixed(1)), unit: "小时",
      tags: ["睡眠"],
    });

    /* 喝水：按 2000ml 目标播 —— 稳的时候 8 杯（2000），近两周递减 */
    const cups = i <= 5 ? 6 : i <= 13 ? 7 : 8;
    for (let c = 0; c < cups; c++) {
      const hh = 7 + c * 2;
      push({
        at: `${date}T${String(hh).padStart(2, "0")}:05`, date, ruleId: "r-water",
        text: `一杯水 250ml`, value: 250, unit: "ml", tags: ["饮水"],
      });
    }

    /* 三餐 */
    push({ at: `${date}T08:20`, date, ruleId: undefined, text: "早餐：牛奶 鸡蛋 全麦面包", tags: ["饮食"], value: 3, unit: "种" });
    push({ at: `${date}T12:30`, date, ruleId: undefined, text: "午餐", tags: ["饮食"], value: 3, unit: "种" });
    if (i % 2 === 0) push({ at: `${date}T19:00`, date, ruleId: undefined, text: "晚餐", tags: ["饮食"], value: 2, unit: "种" });

    /* 专注格 */
    if (!(recent && i % 2 === 1)) {
      push({ at: `${date}T09:${String(30 + (i % 20)).padStart(2, "0")}`, date, ruleId: "r-focus", text: "专注 25 分钟", value: 1, unit: "格", tags: ["专注"] });
    }

    /* 快走：近两周断掉 */
    if (i > 13 || (i <= 13 && i % 4 === 0)) {
      push({ at: `${date}T19:00`, date, ruleId: "r-walk", text: "快走 40 分钟", value: 40, unit: "分钟", tags: ["训练"] });
    }

    /* 学习 */
    if (!recent || i % 2 === 0) {
      push({ at: `${date}T21:00`, date, ruleId: "r-study", text: "看书 1 小时", value: 1, unit: "小时", tags: ["成长"] });
    }

    /* 情绪记录：近一周没记（对应「没动」），更早每天一条 */
    if (i > 6) {
      const moods = ["平稳", "舒展", "平静", "很好", "低落"];
      const mood = moods[(i * 3) % moods.length];
      push({
        at: `${date}T22:00`, date, ruleId: "r-mood",
        text: mood, value: 1, unit: "次", tags: ["情绪"],
      });
    }

    /* 体态：近一周没记 */
    if (i > 6) {
      push({ at: `${date}T11:00`, date, ruleId: "r-posture", text: "起身活动", value: 1, unit: "次", tags: ["体态"] });
    }

    /* 记账（工具走 B：就是带标签的流）*/
    if (i % 3 !== 1) {
      push({ at: `${date}T12:10`, date, text: `午餐 ${28 + (i % 20)} 元`, value: 28 + (i % 20), unit: "元", sign: "out", account: "微信", tags: ["记账"] });
    }
    if (i % 7 === 0) {
      push({ at: `${date}T20:00`, date, text: "超市采购 156 元", value: 156, unit: "元", sign: "out", account: "银行卡", tags: ["记账"] });
    }

    /* 备忘 / 灵感 */
    if (i % 5 === 0) {
      push({ at: `${date}T22:30`, date, text: "想读《城市的胜利》", tags: ["备忘"] });
    }
  }

  /* 今天再多几条，让"记一笔"看起来是活的 */
  push({ at: `${T}T09:30`, date: T, ruleId: "r-focus", text: "专注 25 分钟", value: 1, unit: "格", tags: ["专注"] });
  return out;
}

/* ── 系统的提议（C4 的落点）── */
function proposals(): ProposalDoc[] {
  return [
    {
      id: "pr-review",
      /* ⚠ 文案要经得起核查：第一次打开时说"你 3 周没来过"是假的。
         改成基于**记录**的说法（这是能核查的）。 */
      kind: "review-rhythm",
      headline: "你已经记了 44 天。要不要定个固定时间回看？",
      evidence: "记录连续 44 天没断过，但「回看」还没形成节奏 —— 建议每周日晚上看一眼",
      at: `${T}T08:00`,
    },
    {
      id: "pr-water",
      kind: "adjust",
      headline: "喝水在往下掉：前 30 天 30/30，近 14 天只有 12/14",
      evidence: "近两周每天从 8 杯降到 6 杯，原始饮水从 2000ml 掉到 1500ml",
      draft: { id: "r-water", target: 1800 },
      at: `${T}T08:01`,
    },
    {
      id: "pr-sleep",
      kind: "adjust",
      headline: "入睡时间在往后推：前 30 天 24/30，近 14 天 9/14",
      evidence: "近 14 天里有 11 天在 1 点后入睡，原始入睡时间从 23:10 推到 00:20",
      draft: { id: "r-sleep", target: 6.5 },
      at: `${T}T08:02`,
    },
    {
      id: "pr-exam",
      kind: "period",
      headline: "你连着 3 周在记「图书馆 3 小时」。这是一段时期吗？",
      evidence: "近 21 天有 15 天出现学习相关记录，集中在下午与晚上",
      draft: { title: "图书馆攻坚", kind: "period", mentions: ["r-focus", "r-study"] },
      at: `${T}T08:03`,
    },
  ];
}

/* ── 工具视图（走 B：工具 = 标签 + 筛选视图）── */
function toolViews(): ToolViewDoc[] {
  return [
    { id: "tv-expense", name: "记账", tag: "记账", order: 1 },
    { id: "tv-memo", name: "备忘", tag: "备忘", order: 2 },
    { id: "tv-countdown", name: "倒数日", tag: "倒数日", order: 3 },
    { id: "tv-people", name: "重要的人", tag: "关系", order: 4 },
  ];
}

/* ── 入口 ─────────────────────────────────────────────────── */
/** 种子版本 —— **改了下面任何播种内容就把它加 1**，否则老库不会重播 */
const SEED_VERSION = "3";

export async function ensureSeed(): Promise<void> {
  const rec = await db.meta.get("seed");
  if (rec?.value === SEED_VERSION) return;

  /* ⚠ Dexie 的事务最多 6 张表（数组式与变参式都封顶 6：
     "Expected 3-6 arguments, but got 7"）。
     我们有 5 张业务表 + 1 张 meta ⟹ 只把 5 张业务表放进事务，
     meta 的写入放在事务之后（先写数据、再记版本，避免半途留下"已播"的错标）。 */
  await db.transaction("rw", db.rules, db.entries, db.proposals, db.toolViews, async () => {
    await Promise.all([
      db.rules.clear(),
      db.entries.clear(),
      db.proposals.clear(),
      db.toolViews.clear(),
    ]);
    await insertMany("rules", rules());
    await insertMany("entries", entries());
    await insertMany("proposals", proposals());
    await insertMany("toolViews", toolViews());
  });
  await db.meta.put({ key: "seed", value: SEED_VERSION });
}

export async function clearAll(): Promise<void> {
  await db.rules.clear();
  await db.entries.clear();
  await db.proposals.clear();
  await db.toolViews.clear();
  await db.meta.clear();
}
