"use client";

/**
 * 系统提议卡 —— 能力 C4 的落点（定稿 §3.2）
 *
 * 「系统只提议，人按确认」—— 不违反「决定权必须在人」
 * 三种处理：就这个 / 改一个数 / 不用
 */

import { useState } from "react";
import { db, type ProposalDoc, type RuleDoc, uid } from "@/lib/db";
import { notifyChanged } from "@/lib/useData";

export function ProposalCard({
  p,
  onDone,
}: {
  p: ProposalDoc;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(
    p.draft?.target != null ? String(p.draft.target) : "",
  );

  async function resolve(status: "accepted" | "dismissed") {
    setBusy(true);
    await db.proposals.update(p.id, { resolved: status });
    setBusy(false);
    notifyChanged();
    onDone?.();
  }

  async function accept() {
    setBusy(true);
    const d = p.draft ?? {};

    if (p.kind === "adjust" && d.id && d.target != null) {
      // 改一条已有规则的标准
      await db.rules.update(d.id, { target: d.target, updatedAt: Date.now() });
    } else if (p.kind === "period") {
      // 声明一段时期（只存引用，不拥有）
      const rule: RuleDoc = {
        id: uid("p"),
        title: d.title ?? "新的一段时期",
        kind: "period",
        home: d.home,
        mentions: d.mentions ?? [],
        periodGoal: d.periodGoal,
        state: "growing",
        updatedAt: Date.now(),
        order: 100,
      };
      await db.rules.add(rule);
    } else {
      // 新建一条规则
      const rule: RuleDoc = {
        id: uid("r"),
        title: d.title ?? "新规则",
        kind: "rule",
        home: d.home ?? "未归置",
        target: d.target,
        unit: d.unit,
        cadence: "daily",
        state: "growing",
        updatedAt: Date.now(),
        order: 50,
      };
      await db.rules.add(rule);
    }

    await db.proposals.update(p.id, { resolved: "accepted" });
    setBusy(false);
    notifyChanged();
    onDone?.();
  }

  async function acceptEdited() {
    const n = Number(val);
    if (!Number.isFinite(n)) return;
    setBusy(true);
    if (p.draft?.id) {
      await db.rules.update(p.draft.id, { target: n, updatedAt: Date.now() });
    }
    await db.proposals.update(p.id, { resolved: "accepted" });
    setBusy(false);
    notifyChanged();
    onDone?.();
  }

  /* 依据类型给不同按钮 */
  const primaryLabel =
    p.kind === "period" ? "成一段时期" : p.kind === "review-rhythm" ? "好" : "就这个";
  const canEdit = p.kind === "adjust" && p.draft?.id != null;

  return (
    <div className="proposal">
      <div className="proposal__head">
        <span className="t-bold t-sm">系统提议</span>
        <span className="proposal__eyebrow">从记录里看出来</span>
      </div>
      <p className="proposal__headline">{p.headline}</p>
      <p className="proposal__evidence">{p.evidence}</p>

      {p.draft?.title || p.draft?.target != null ? (
        <div className="proposal__draft">
          {p.draft.title ? <div className="t-bold t-sm">{p.draft.title}</div> : null}
          {p.draft.target != null ? (
            <div className="t-cap t-mut">
              标准 {p.draft.target}
              {p.draft.unit ?? ""} · 长期
            </div>
          ) : null}
          {p.draft.mentions?.length ? (
            <div className="t-cap t-mut">提到 {p.draft.mentions.length} 条规则</div>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            style={{ maxWidth: 120 }}
            value={val}
            inputMode="decimal"
            onChange={(e) => setVal(e.target.value)}
            aria-label="新标准"
          />
          <button className="btn btn--sm btn--primary" disabled={busy} onClick={acceptEdited}>
            就这样
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => setEditing(false)}>
            返回
          </button>
        </div>
      ) : (
        <div className="proposal__actions">
          <button className="btn btn--sm btn--primary" disabled={busy} onClick={accept}>
            {primaryLabel}
          </button>
          {canEdit ? (
            <button className="btn btn--sm" disabled={busy} onClick={() => setEditing(true)}>
              改一个数
            </button>
          ) : null}
          <button
            className="btn btn--sm btn--ghost"
            disabled={busy}
            onClick={() => resolve("dismissed")}
          >
            不用
          </button>
        </div>
      )}
    </div>
  );
}
