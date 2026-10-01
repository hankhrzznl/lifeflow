"use client";

/**
 * 记一笔 —— 界面 01 的核心（定稿 §8.2 决定 4）
 *
 * **主路径 = 点一下**：常用项在最上，一次点击立刻落盘，不再确认。
 * 打一句话降级为联想（辅助，不是主路径）。
 *
 * 依据：最高痛点是「忘了记」；点一下比打一句话少一个动作；
 *       A6 要求上游动作最便宜。
 */

import { useState } from "react";
import { nowLocal, uid, type EntryDoc, type RuleDoc } from "@/lib/db";
import { insert } from "@/lib/write";
import { metricsOf } from "@/lib/metrics";
import { useData } from "@/lib/useData";

interface Quick {
  label: string;
  text: string;
  value?: number;
  unit?: string;
  tags: string[];
  ruleId?: string;
}

/** 常用项 —— 与任何规则无关的随手记（吃喝、备忘、账目这类） */
const QUICKS: Quick[] = [
  { label: "咖啡", text: "一杯咖啡", tags: ["饮食"] },
  { label: "午餐", text: "午餐", tags: ["饮食"] },
  { label: "记一笔账", text: "", tags: ["记账"] },
  { label: "备忘", text: "", tags: ["备忘"] },
  { label: "心情", text: "", tags: ["情绪"] },
];

const TOOL_QUICKS: Quick[] = [
  { label: "记账", text: "", tags: ["记账"] },
  { label: "备忘", text: "", tags: ["备忘"] },
  { label: "倒数日", text: "", tags: ["倒数日"] },
  { label: "重要的人", text: "", tags: ["关系"] },
];

export function QuickSheet({
  open,
  onClose,
  defaultRuleId,
}: {
  open: boolean;
  onClose: () => void;
  defaultRuleId?: string;
}) {
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const data = useData();

  if (!open) return null;

  /* 在养的规则 —— 点一下就按它的标准记一笔。
     ⚠ 这一段是"记录 → 指标"的闭环：不接的话，
        「睡稳 30/30」这类数字永远不会动，回看也永远没料。 */
  const liveRules: RuleDoc[] =
    data.status === "ready"
      ? data.data.rules.filter(
          (r) => r.state === "growing" && (r.kind === "rule" || r.kind === "linear"),
        )
      : [];
  const today = nowData();

  function nowData(): string {
    return nowLocal().date;
  }

  /**
   * 按规则记一笔 —— **一次点击 = 今天这条达标**（补差额，不超记）。
   *
   * ⚠ 这里踩过两个坑，都是 e2e 抓到的：
   *   坑① 把"规则目标"当成"每次增量" ⟹ 点「喝水 2000ml」记了 2000，
   *        当天累计从 1500 跳到 3500，**一次点击超过全天目标**，数字失真。
   *   坑② 只把文案改成"记满"，值仍是整个目标 ⟹ 结果一模一样。
   *        文案改了、行为没改，这种"假修"只有断言看得见。
   *
   * 根因：**"一杯 250ml"与"全天 2000ml"是两个刻度**，规则里只存了后者。
   *   前者推不出来 —— 睡眠 7 小时一次、喝水 250ml 一次、快走 40 分钟一次，
   *   没有统一规律，不能猜。
   *
   * 正确做法：**补差额** —— 值 = max(目标 − 今天已累计, 0)。
   *   点完当天累计**恰好等于**目标：已达标则不写记录（返回 null），
   *   没达标则补齐到正好达标。零碎的多次记录走「随手记」。
   */
  function ruleQuick(r: RuleDoc): Quick | null {
    const target = r.target ?? 1;
    const remain = Math.max(target - todaySum(r.id), 0);
    if (remain <= 0) return null; // 已达标：不写空记录
    return {
      label: `${r.title} 记满`,
      text: `${r.title} ${remain}${r.unit ?? ""}`,
      value: remain,
      unit: r.unit,
      tags: [r.home ?? r.title],
      ruleId: r.id,
    };
  }

  /** 今天这条已累计多少（记满要按差额补，所以必须先知道） */
  function todaySum(ruleId: string): number {
    if (data.status !== "ready") return 0;
    const d = nowLocal().date;
    return data.data.entries
      .filter((e) => e.ruleId === ruleId && e.date === d)
      .reduce((s, e) => s + (e.value ?? 1), 0);
  }

  function reset() {
    setText("");
    setAmount("");
    setTool(null);
  }

  async function add(partial: Partial<EntryDoc> & { text: string; tags: string[] }) {
    const { at, date } = nowLocal();
    const doc: EntryDoc = {
      id: uid(),
      at,
      date,
      ruleId: partial.ruleId ?? defaultRuleId,
      text: partial.text || partial.tags[0],
      value: partial.value,
      unit: partial.unit,
      tags: partial.tags,
      sign: partial.sign,
      account: partial.account,
      createdAt: Date.now(),
    };
    /* 走写入层（lib/write.ts）：它负责盖 updatedAt / userId 并广播刷新。
       不要直接 db.entries.add —— 那样同步会漏掉这一条。 */
    await insert("entries", doc);
    setFlash(`已记下 · ${doc.text}`);
    setTimeout(() => setFlash(null), 1600);
  }

  async function tapQuick(q: Quick) {
    // 「记一笔账」这类需要金额的，先切到输入态
    if (!q.text && q.tags.includes("记账")) {
      setTool("记账");
      return;
    }
    if (!q.text) {
      setTool(q.tags[0]);
      return;
    }
    await add({ text: q.text, value: q.value, unit: q.unit, tags: q.tags, ruleId: q.ruleId });
  }

  async function submitText() {
    const t = text.trim();
    if (!t) return;
    if (tool === "记账") {
      const n = Number(amount);
      await add({
        text: t,
        value: Number.isFinite(n) && n > 0 ? n : undefined,
        unit: "元",
        sign: "out",
        tags: ["记账"],
      });
    } else if (tool) {
      await add({ text: t, tags: [tool] });
    } else {
      await add({ text: t, tags: [] });
    }
    reset();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="记一笔"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "var(--scrim)",
        backdropFilter: "blur(3px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "88vh",
          overflowY: "auto",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="row--between">
          <span className="t-h3">记一笔</span>
          <button className="btn btn--sm btn--ghost" onClick={onClose}>
            收起
          </button>
        </div>

        {/* ① 在养的规则 —— 点一下按标准记一笔（记录 → 指标的闭环）*/}
        {liveRules.length ? (
          <>
            <div className="row--between" style={{ marginTop: 12 }}>
              <span className="t-bold t-sm">在养的</span>
              <span className="t-cap t-faint">点一下 = 这条记满</span>
            </div>
            <div className="row row--wrap" style={{ marginTop: 8, gap: 6 }}>
              {liveRules.map((r) => {
                const sum = todaySum(r.id);
                const q = ruleQuick(r);
                const done = q === null;
                const m = metricsOf(r, data.status === "ready" ? data.data.entries : [], today);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`pill${done ? " pill--on" : ""}`}
                    disabled={done}
                    onClick={() => {
                      if (q) void tapQuick(q);
                    }}
                    title={
                      done
                        ? `今天已经达标了（${sum}${r.unit ?? ""}）`
                        : r.target != null
                          ? `点一下补到刚好达标：还差 ${Math.max((r.target ?? 1) - sum, 0)}${r.unit ?? ""}`
                          : "记一次即达标"
                    }
                  >
                    {r.title}
                    {done ? (
                      <span className="t-cap" style={{ opacity: 0.75 }}>
                        ✓
                      </span>
                    ) : (
                      <span className="t-cap" style={{ opacity: 0.75 }}>
                        还差 {r.target != null ? Math.max(r.target - sum, 0) : 1}
                        {r.unit ?? ""}
                      </span>
                    )}
                    {!done && m.streak > 0 ? (
                      <span className="t-cap" style={{ opacity: 0.6 }}>
                        {m.streak}天
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="t-cap t-faint" style={{ marginTop: 6 }}>
              点一下 <b>补到刚好达标</b>，不会超记。记录今天喝了三杯那种走下面的「随手记」。
            </p>
          </>
        ) : null}

        {/* ② 常用（与规则无关的随手记）*/}
        <div className="row--between" style={{ marginTop: 14 }}>
          <span className="t-bold t-sm">随手记</span>
          <span className="t-cap t-faint">点一下即记，不再确认</span>
        </div>
        <div className="row row--wrap" style={{ marginTop: 8, gap: 6 }}>
          {QUICKS.map((q) => (
            <button key={q.label} type="button" className="pill" onClick={() => tapQuick(q)}>
              {q.label}
            </button>
          ))}
        </div>

        {/* ③ 一行输入（降级为辅助）*/}
        <div className="row--between" style={{ marginTop: 16 }}>
          <span className="t-bold t-sm">或者打一句话</span>
          {tool ? <span className="tag tag--grow">{tool}</span> : null}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          {tool === "记账" ? (
            <input
              className="input"
              style={{ maxWidth: 96 }}
              placeholder="金额"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="金额"
            />
          ) : null}
          <input
            className="input grow"
            placeholder={tool === "记账" ? "花在哪了" : "说一句就行：一杯水 / 午饭 38 / 专注 25 分钟…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitText();
            }}
            aria-label="记一句话"
          />
          <button className="btn btn--primary" onClick={submitText} disabled={!text.trim()}>
            记下
          </button>
        </div>

        {/* ④ 工具（走 B：就是带标签的流）*/}
        <div className="row--between" style={{ marginTop: 16 }}>
          <span className="t-bold t-sm">工具</span>
          <span className="t-cap t-faint">不进养成链，但数会进统计</span>
        </div>
        <div className="row row--wrap" style={{ marginTop: 8, gap: 6 }}>
          {TOOL_QUICKS.map((q) => (
            <button
              key={q.label}
              type="button"
              className={`pill${tool === q.tags[0] ? " pill--on" : ""}`}
              onClick={() => setTool(q.tags[0])}
            >
              {q.label}
            </button>
          ))}
        </div>

        {flash ? (
          <p
            className="t-cap"
            style={{ marginTop: 14, color: "var(--life-green)", fontWeight: 600 }}
            role="status"
          >
            {flash}
          </p>
        ) : null}
      </div>
    </div>
  );
}
