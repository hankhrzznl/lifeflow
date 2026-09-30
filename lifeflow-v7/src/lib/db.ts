/**
 * LifeFlow v7 · 数据层
 * 单一事实源：_设计/00-设计定稿-一份记录三种姿态.md §7
 *
 * ── 为什么只有两张表 ────────────────────────────────────────────
 * 公理 A1：数据是一条流 —— `时刻 · 做了什么 · 值`。记录只有一种形状。
 * 所以历史上 38 个 localStorage key（13 个流 + 24 个规则）全部收敛成两张表：
 *
 *   rules    = 规则（承诺 / 时期 / 预算 / 提醒设定）—— 单对象，长期不变（A4'）
 *   entries  = 流（发生过的）—— 按时刻追加，只增不改
 *
 * 公理 A5：目标分线性 / 多因素两类。
 *   线性   → 一条普通 rule（标准 + 跨度），进度可直接数
 *   多因素 → 一条 `kind: "period"` 的 rule，用 `mentions` 提到若干条别的 rule；
 *            进度由被提到的那几条的合力决定，**报瓶颈，不做平均**
 *
 * ⚠ 四条硬约束（引用不是树，定稿 §7）：
 *   1. 时期只存引用，不拥有规则          → 用 mentions: string[]，不建父子字段
 *   2. 数据里不出现「规则的父级是时期」  → 见下，RuleDoc 没有 parentId
 *   3. 时期归档时被提到的规则状态不变      → 见 metrics.ts 的归档处理
 *   4. 任何规则任何时刻都能在自己家里找到  → 规则是平表，不是树
 */
import Dexie, { type EntityTable } from "dexie";

/* ─────────────────────────────────────────────────────────────
   规则（rules）—— 定稿 §7「规则（承诺）」
   状态只有四个：在养 / 稳了 / 暂停 / 归档。**没有"完成"**（A5）
   ───────────────────────────────────────────────────────────── */
export type RuleState = "growing" | "solid" | "paused" | "archived";

/** 目标形态：普通规则 / 线性目标（可数里程碑）/ 多因素目标（时期）/ 工具设定 */
export type RuleKind = "rule" | "linear" | "period" | "setting";

export interface RuleDoc {
  id: string;
  /** 一句话 —— 如「睡稳」 */
  title: string;
  kind: RuleKind;
  /** 归置用的标签（域 / 工具）。**不构成归属关系**，只用于归置与检索 */
  home?: string;
  /** 额外标签（工具名、分类等） */
  tags?: string[];

  /* ── 标准：做到什么算数。留空 = 不限期（定稿 §7） ── */
  /** 每天/每周的目标值。如 7（小时）、2000（ml） */
  target?: number;
  /** 目标值的单位，用于显示与口径 */
  unit?: string;
  /** 频率：每天 / 每周 */
  cadence?: "daily" | "weekly";
  /** 每周几次（cadence=weekly 时用） */
  perWeek?: number;

  /* ── 跨度：起始 → 截止。都留空 = 长期 ── */
  start?: string; // YYYY-MM-DD
  end?: string;

  /* ── 多因素目标（A5）：提到哪几条别的规则。**只存引用，不拥有** ── */
  mentions?: string[];
  /** 时期级的一句目标 —— **只作展示，不参与判稳**（定稿 §7 三条规则） */
  periodGoal?: string;
  /** 这段期间的临时标准：被提到规则的 id → 收紧/放宽后的值 */
  tempTargets?: Record<string, number>;

  /* ── 状态 ── */
  state: RuleState;
  /** 排序用 */
  order?: number;
  updatedAt: number;
}

/* ─────────────────────────────────────────────────────────────
   流（entries）—— 定稿 §7「流」
   一条 = 时刻 + 指向哪条规则 + 值
   情绪一条、饮水一杯、专注 25 分钟、账目一笔、一次联系 —— 都是这一条结构
   ───────────────────────────────────────────────────────────── */
export interface EntryDoc {
  id: string;
  /** 时刻（ISO，本地时区写字符串，避免时区误判） */
  at: string; // YYYY-MM-DDTHH:mm
  /** 日期（YYYY-MM-DD）—— 冗余存一份，便于按天聚合并加索引 */
  date: string;
  /** 指向哪条规则。**可以为空**（随手记的、还没归到任何规则上） */
  ruleId?: string;
  /** 文本（"做了什么"） */
  text: string;
  /** 值（可选）。如 250（ml）、25（分钟）、38（元）、7.2（小时） */
  value?: number;
  /** 单位 */
  unit?: string;
  /** 归置标签（域 / 工具），**不构成归属** */
  tags?: string[];

  /* ── 工具走 B（定稿 §8.2）：工具特有字段挂在流上，不建新实体 ── */
  /** 金额（记账用；value 存绝对值，sign 表收支） */
  sign?: "in" | "out";
  /** 账户（记账用，可选） */
  account?: string;

  createdAt: number;
}

/* ─────────────────────────────────────────────────────────────
   系统的提议（proposals）—— 能力 C4 的落点
   定稿 §3.2：既然规则几乎不变，就不该由人手工填写，而应由系统从真实记录里
   长出来、请人确认。**系统只提议，人按确认**（不违反"决定权必须在人"）
   ───────────────────────────────────────────────────────────── */
export type ProposalKind = "new-rule" | "period" | "adjust" | "review-rhythm" | "stale-rule";

export interface ProposalDoc {
  id: string;
  kind: ProposalKind;
  /** 给用户看的一句话 */
  headline: string;
  /** 依据（从哪些记录里看出来的），用于让提议可核查 */
  evidence: string;
  /** 提议出来的规则草稿（kind=new-rule / period 时用） */
  draft?: Partial<RuleDoc>;
  /** 提议的时间 */
  at: string;
  /** 用户已处理：accepted / dismissed。未处理的不写这个字段 */
  resolved?: "accepted" | "dismissed";
}

/* ─────────────────────────────────────────────────────────────
   工具（tools）—— 界面 05
   走 B：工具 = 标签 + 一个筛选视图，所以这里只存"有哪些视图、叫什么"
   ───────────────────────────────────────────────────────────── */
export interface ToolViewDoc {
  id: string;
  name: string;
  /** 筛哪个标签 */
  tag: string;
  order?: number;
}

/* ─────────────────────────────────────────────────────────────
   元数据（meta）—— 目前只存"种子版本"
   ⚠ 教训：Dexie 的 version(N) 只做**结构**迁移、不清数据，
     而 ensureSeed 见 rules 非空就跳过 ⟹ 改了播种内容后，老库不会重播。
     所以用 meta.seed 记住播的是哪一版，对不上就重播。
   ───────────────────────────────────────────────────────────── */
export interface MetaDoc {
  key: string;
  value: string;
}

/* ─────────────────────────────────────────────────────────────
   Dexie
   ───────────────────────────────────────────────────────────── */
class LifeFlowDB extends Dexie {
  rules!: EntityTable<RuleDoc, "id">;
  entries!: EntityTable<EntryDoc, "id">;
  proposals!: EntityTable<ProposalDoc, "id">;
  toolViews!: EntityTable<ToolViewDoc, "id">;
  meta!: EntityTable<MetaDoc, "key">;

  constructor() {
    super("lifeflow-v7");
    this.version(1).stores({
      rules: "id, state, kind, home, order",
      entries: "id, date, at, ruleId, *tags",
      proposals: "id, kind, at",
      toolViews: "id, order",
      meta: "key",
    });
  }
}

export const db = new LifeFlowDB();

/* ─────────────────────────────────────────────────────────────
   小工具
   ───────────────────────────────────────────────────────────── */
export function nowLocal(): { at: string; date: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const at = `${date}T${p(d.getHours())}:${p(d.getMinutes())}`;
  return { at, date };
}

export function uid(prefix = "e"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayDate(): string {
  return nowLocal().date;
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T12:00:00`).getTime();
  const d2 = new Date(`${b}T12:00:00`).getTime();
  return Math.round((d2 - d1) / 86400000);
}
