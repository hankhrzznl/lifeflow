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
import { nowLocal, uid, type EntryDoc } from "@/lib/db";
import { insert } from "@/lib/write";

interface Quick {
  label: string;
  text: string;
  value?: number;
  unit?: string;
  tags: string[];
  ruleId?: string;
}

/** 常用项 —— 系统按用途排的顺序（可后续改成"按频率自动排"）*/
const QUICKS: Quick[] = [
  { label: "水 250ml", text: "一杯水 250ml", value: 250, unit: "ml", tags: ["饮水"], ruleId: "r-water" },
  { label: "咖啡", text: "一杯咖啡", tags: ["饮食"] },
  { label: "午餐", text: "午餐", tags: ["饮食"] },
  { label: "专注 25 分", text: "专注 25 分钟", value: 1, unit: "格", tags: ["专注"], ruleId: "r-focus" },
  { label: "起身", text: "起身活动", value: 1, unit: "次", tags: ["体态"], ruleId: "r-posture" },
  { label: "快走 40 分", text: "快走 40 分钟", value: 40, unit: "分钟", tags: ["训练"], ruleId: "r-walk" },
  { label: "记一笔账", text: "", tags: ["记账"] },
  { label: "心情", text: "", tags: ["情绪"], ruleId: "r-mood" },
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

  if (!open) return null;

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

        {/* ① 常用（主角）*/}
        <div className="row--between" style={{ marginTop: 12 }}>
          <span className="t-bold t-sm">常用的</span>
          <span className="t-cap t-faint">点一下即记，不再确认</span>
        </div>
        <div className="row row--wrap" style={{ marginTop: 8, gap: 6 }}>
          {QUICKS.map((q) => (
            <button key={q.label} type="button" className="pill" onClick={() => tapQuick(q)}>
              {q.label}
            </button>
          ))}
        </div>

        {/* ② 一行输入（降级为辅助）*/}
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

        {/* ③ 工具（走 B：就是带标签的流）*/}
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
