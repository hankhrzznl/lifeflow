"use client";

/**
 * 界面 04 · 往后（时间姿态：往后按什么来）
 * 定稿 §3.2 C4：**系统推候选、人按确认**（因为 A4' 说规则几乎不变）
 *
 * 这一页被 A4' 改变最大：不做表单，做「一张你确认候选的卡」。
 * 手机上只做"改一个数 / 按确认"；批量改、声明时期、导出留给电脑（依据 A3）。
 *
 * A5 两类目标：线性（可数里程碑）/ 多因素（时期提到几条规则）
 * 状态只有四个：在养 / 稳了 / 暂停 / 归档 —— **没有"完成"**
 */

import { useState } from "react";
import { useData } from "@/lib/useData";
import { uid, type RuleDoc, type RuleState } from "@/lib/db";
import { insert, patch } from "@/lib/write";
import { metricsOf } from "@/lib/metrics";
import { StateTag, SyncDot } from "@/components/Parts";
import { ProposalCard } from "@/components/ProposalCard";
import { SyncPanel } from "@/components/SyncPanel";

const STATE_LABEL: Record<RuleState, string> = {
  growing: "在养",
  solid: "稳了",
  paused: "暂停",
  archived: "归档",
};

export default function FuturePage() {
  const state = useData();
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [kind, setKind] = useState<"rule" | "linear">("rule");
  const [batch, setBatch] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [periodName, setPeriodName] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  if (state.status === "loading") {
    return (
      <main className="stack">
        <div className="hint">正在准备…</div>
      </main>
    );
  }

  const { rules, entries, openProposals, proposals, toolViews } = state.data;

  async function setState(id: string, s: RuleState) {
    await patch("rules", id, { state: s });
  }

  async function setTarget(id: string, v: number) {
    await patch("rules", id, { target: v });
    setMsg("已改 · 会影响「此刻」推给你的那一件");
    setTimeout(() => setMsg(null), 2200);
  }

  async function addRule() {
    const t = newTitle.trim();
    if (!t) {
      setMsg("先写一句话");
      return;
    }
    const n = Number(newTarget);
    const rule: RuleDoc = {
      id: uid("r"),
      title: t,
      kind,
      target: Number.isFinite(n) && n > 0 ? n : undefined,
      unit: newUnit.trim() || undefined,
      cadence: "daily",
      state: "growing",
      updatedAt: Date.now(),
      order: 50,
    };
    await insert("rules", rule);
    setNewTitle("");
    setNewTarget("");
    setNewUnit("");
    setMsg("已加");
    setTimeout(() => setMsg(null), 2000);
  }

  async function applyBatch() {
    let n = 0;
    for (const [id, v] of Object.entries(batch)) {
      const num = Number(v);
      if (!Number.isFinite(num) || num <= 0) continue;
      const r = rules.find((x) => x.id === id);
      if (!r || r.target === num) continue;
      await patch("rules", id, { target: num });
      n++;
    }
    setBatch({});
    setMsg(`已应用 ${n} 处改动`);
    setTimeout(() => setMsg(null), 2400);
  }

  async function addPeriod() {
    const t = periodName.trim();
    if (!t || !periodFrom || !periodTo) {
      setMsg("时期需要 名字 + 起止");
      return;
    }
    const rule: RuleDoc = {
      id: uid("p"),
      title: t,
      kind: "period",
      start: periodFrom,
      end: periodTo,
      mentions: [],
      state: "growing",
      updatedAt: Date.now(),
      order: 100,
    };
    await insert("rules", rule);
    setPeriodName("");
    setPeriodFrom("");
    setPeriodTo("");
    setMsg("已声明一段时期（只存引用，不拥有规则）");
    setTimeout(() => setMsg(null), 2600);
  }

  async function toggleMention(periodId: string, ruleId: string) {
    const p = rules.find((r) => r.id === periodId);
    if (!p) return;
    const cur = p.mentions ?? [];
    const next = cur.includes(ruleId) ? cur.filter((x) => x !== ruleId) : [...cur, ruleId];
    await patch("rules", periodId, { mentions: next });
  }

  async function exportAll() {
    // ⚠ 不要在闭包里再用 state.data —— TS 的窄化不会跨进闭包，
    //    这里已经在外层解构过了，直接用那些值。
    const payload = {
      exportedAt: new Date().toISOString(),
      rules,
      entries,
      proposals,
      toolViews,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lifeflow-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("已导出");
    setTimeout(() => setMsg(null), 1800);
  }

  const active = rules.filter((r) => r.kind === "rule" || r.kind === "linear");
  const periods = rules.filter((r) => r.kind === "period");
  const settings = rules.filter((r) => r.kind === "setting");

  return (
    <>
      <main className="stack">
        <div className="row--between">
          <span className="t-h3">往后</span>
          <SyncDot label={`${active.length} 条 · ${periods.length} 段时期`} />
        </div>

        {msg ? (
          <div className="note" role="status">
            {msg}
          </div>
        ) : null}

        {openProposals.length ? (
          <div className="stack">
            {openProposals.slice(0, 2).map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </div>
        ) : null}

        {/* ── 规则清单 ── */}
        <section className="card">
          <div className="row--between">
            <span className="t-bold">规则</span>
            <span className="t-cap t-faint">按状态排</span>
          </div>
          <div className="list" style={{ marginTop: 6 }}>
            {active.map((r) => {
              const m = metricsOf(r, entries);
              return (
                <div className="list__row" key={r.id}>
                  <div className="row--between">
                    <span className="t-sm">
                      <b>{r.title}</b>{" "}
                      <span className="t-cap t-mut">
                        {r.kind === "linear"
                          ? `${r.start ?? ""} – ${r.end ?? ""}`
                          : r.target != null
                            ? `标准 ${r.target}${r.unit ?? ""}`
                            : `${(r.cadence ?? "daily") === "daily" ? "每天" : "每周"}${
                                r.perWeek ? ` ${r.perWeek} 次` : ""
                              }`}
                      </span>
                    </span>
                    <StateTag m={m} />
                  </div>
                  <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: "wrap" }}>
                    {r.target != null ? (
                      <>
                        <button
                          className="btn btn--sm"
                          onClick={() => setTarget(r.id, Math.max(1, (r.target ?? 1) - (r.target && r.target > 10 ? 100 : 0.5)))}
                        >
                          −
                        </button>
                        <span className="t-cap t-num t-mut">
                          {r.target}
                          {r.unit ?? ""}
                        </span>
                        <button
                          className="btn btn--sm"
                          onClick={() => setTarget(r.id, (r.target ?? 0) + (r.target && r.target > 10 ? 100 : 0.5))}
                        >
                          +
                        </button>
                      </>
                    ) : null}
                    <span className="grow" />
                    {r.state === "growing" ? (
                      <button className="btn btn--sm" onClick={() => setState(r.id, "paused")}>
                        暂停
                      </button>
                    ) : (
                      <button className="btn btn--sm" onClick={() => setState(r.id, "growing")}>
                        恢复
                      </button>
                    )}
                    <button className="btn btn--sm btn--ghost" onClick={() => setState(r.id, "archived")}>
                      归档
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="t-cap t-faint" style={{ marginTop: 8 }}>
            状态只有四个：在养 / 稳了 / 暂停 / 归档 —— <b>没有&ldquo;完成&rdquo;</b>
          </p>
        </section>

        {/* ── 时期 ── */}
        <section className="card card--dashed">
          <div className="row--between">
            <span className="t-bold">时期</span>
            <span className="t-cap t-faint">{periods.length} 段</span>
          </div>
          {periods.length ? (
            <div className="list" style={{ marginTop: 6 }}>
              {periods.map((p) => (
                <div className="list__row" key={p.id}>
                  <div className="row--between">
                    <span className="t-sm">
                      <b>{p.title}</b>{" "}
                      <span className="t-cap t-mut">
                        {p.start} → {p.end}
                      </span>
                    </span>
                    <span className="tag tag--grow">进行中</span>
                  </div>
                  <div className="t-cap t-mut" style={{ marginTop: 4 }}>
                    提到：
                    {active
                      .filter((r) => (p.mentions ?? []).includes(r.id))
                      .map((r) => r.title)
                      .join(" · ") || "（还没提到任何规则）"}
                  </div>
                  <div className="row row--wrap" style={{ marginTop: 6, gap: 6 }}>
                    {active.map((r) => {
                      const on = (p.mentions ?? []).includes(r.id);
                      return (
                        <button
                          key={r.id}
                          className={`pill pill--sm${on ? " pill--on" : ""}`}
                          onClick={() => toggleMention(p.id, r.id)}
                        >
                          {r.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="t-cap t-mut" style={{ marginTop: 6 }}>
              还没有声明过时期。
            </p>
          )}
          <div className="note" style={{ marginTop: 8 }}>
            时期<b>只存引用、不拥有</b>规则。时期结束，那几条状态不变。
          </div>
        </section>

        {/* ── 加一条 ── */}
        <section className="card">
          <div className="t-bold">加一条</div>
          <div className="segs" style={{ marginTop: 8 }}>
            <button
              className={`pill pill--sm${kind === "rule" ? " pill--on" : ""}`}
              onClick={() => setKind("rule")}
            >
              持续的事（睡稳 / 喝水）
            </button>
            <button
              className={`pill pill--sm${kind === "linear" ? " pill--on" : ""}`}
              onClick={() => setKind("linear")}
            >
              线性目标（读完 20 本）
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input grow"
              placeholder="一句话，如：睡稳"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              className="input"
              style={{ maxWidth: 90 }}
              placeholder="标准"
              inputMode="decimal"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
            />
            <input
              className="input"
              style={{ maxWidth: 80 }}
              placeholder="单位"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            />
          </div>
          <button className="btn btn--primary" style={{ marginTop: 10 }} onClick={addRule}>
            加进去
          </button>
          <p className="t-cap t-faint" style={{ marginTop: 8 }}>
            也可以让系统从你的记录里提一个（见上面的系统提议）
          </p>
        </section>

        {/* ── 多设备同步 ── */}
        <SyncPanel />

        {/* ── 提醒（设定）── */}
        {settings.length ? (
          <section className="card">
            <div className="t-bold">提醒</div>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="list__row row--between">
                <span className="t-sm">晨起</span>
                <span className="t-cap t-faint t-num">07:00</span>
              </div>
              <div className="list__row row--between">
                <span className="t-sm">睡前仪式</span>
                <span className="t-cap t-faint t-num">22:00</span>
              </div>
              <div className="list__row row--between">
                <span className="t-sm">用药</span>
                <span className="t-cap t-faint t-num">08:00 / 21:00</span>
              </div>
            </div>
            <div className="t-cap t-faint" style={{ marginTop: 6 }}>
              设定在这里；触发归系统层；响没响归「回看」
            </div>
          </section>
        ) : null}
      </main>

      {/* ── 电脑/平板右栏：只有大屏才做的事（A3）── */}
      <aside className="shell__aside">
        <div className="card">
          <div className="row--between">
            <span className="t-bold t-sm">批量改标准</span>
            <span className="t-cap t-faint">
              已改 {Object.keys(batch).length} 处
            </span>
          </div>
          <div className="list" style={{ marginTop: 6 }}>
            {active.map((r) => (
              <div className="list__row row" key={r.id}>
                <span className="t-sm grow">{r.title}</span>
                <span className="t-cap t-faint t-num">{r.target ?? "—"}</span>
                <input
                  className="input"
                  style={{ maxWidth: 76, height: 34 }}
                  placeholder="→"
                  inputMode="decimal"
                  value={batch[r.id] ?? ""}
                  onChange={(e) => setBatch((b) => ({ ...b, [r.id]: e.target.value }))}
                  aria-label={`${r.title} 新标准`}
                />
              </div>
            ))}
          </div>
          <button
            className="btn btn--primary btn--sm"
            style={{ marginTop: 8 }}
            disabled={!Object.keys(batch).length}
            onClick={applyBatch}
          >
            应用这些改动
          </button>
          <div className="t-cap t-faint" style={{ marginTop: 6 }}>
            改动会立即影响「此刻」推给你的那一件
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="t-bold t-sm">声明一段时期</div>
          <div className="col" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="名字，如：备考期"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
            />
            <div className="row">
              <input
                className="input"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                aria-label="起"
              />
              <input
                className="input"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                aria-label="止"
              />
            </div>
            <button className="btn btn--sm" onClick={addPeriod}>
              声明
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="t-bold t-sm">数据</div>
          <div className="list" style={{ marginTop: 6 }}>
            <div className="list__row row--between">
              <span className="t-sm">导出全部（JSON）</span>
              <button className="btn btn--sm" onClick={exportAll}>
                导出
              </button>
            </div>
            <div className="list__row row--between">
              <span className="t-sm">一致性自检</span>
              <span className="t-cap t-faint">指标只在一处算 ✓</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
