"use client";

/**
 * 界面 03 · 回看（时间姿态：刚过去）
 * 定稿 §3.1 C3：把流投影成「这段怎样」，且**主动送到眼前**
 *
 * 三组：稳了 / 掉了 / 没动
 * 已并进原「深度」：点开一条 → 竖看它在变好还是变坏
 * 多因素目标（A5）：**不做平均，报瓶颈**（定稿 §8.1 已定）
 *
 * 只读。每个结论旁只给一个出口「去调它」→ 跳「往后」（定稿 §7）
 */

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/useData";
import {
  addDays,
  todayDate,
  type EntryDoc,
  type RuleDoc,
} from "@/lib/db";
import {
  groupAll,
  isDayMet,
  metricsOf,
  periodSummary,
  whySlipping,
  type RuleMetrics,
} from "@/lib/metrics";
import { DotStrip, SyncDot, rate } from "@/components/Parts";
import { ProposalCard } from "@/components/ProposalCard";

const SPAN = 30;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function stripOf(rule: RuleDoc, entries: EntryDoc[], today: string): (boolean | null)[] {
  return Array.from({ length: SPAN }, (_, i) => {
    const d = addDays(today, -(SPAN - 1 - i));
    return isDayMet(rule, entries, d);
  });
}

/* ── 一条规则的横看行 ─────────────────────────────────── */
function RuleRow({
  m,
  entries,
  today,
  onDrill,
}: {
  m: RuleMetrics;
  entries: EntryDoc[];
  today: string;
  onDrill: () => void;
}) {
  return (
    <div className="list__row">
      <div className="row--between">
        <span className="t-sm">{m.rule.title}</span>
        <span className="t-cap t-num t-mut">
          {m.metDays}/{m.windowDays} · {rate(m.rate)}
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        <DotStrip days={stripOf(m.rule, entries, today)} />
      </div>
      <div className="row--between" style={{ marginTop: 6 }}>
        <span className="t-cap t-faint">
          {m.streak > 0 ? `连着 ${m.streak} 天` : "今天还没达标"}
          {m.maxGap >= 5 ? ` · 最长断 ${m.maxGap} 天` : ""}
        </span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn btn--sm" onClick={onDrill}>
            点开这一条 ›
          </button>
        </span>
      </div>
    </div>
  );
}

/* ── 竖看（原「深度」并进来的部分）─────────────────────── */
function Drill({
  m,
  entries,
  today,
  rules,
  onClose,
}: {
  m: RuleMetrics;
  entries: EntryDoc[];
  today: string;
  rules: RuleDoc[];
  onClose: () => void;
}) {
  /* 按周聚合最近 6 周 */
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const w = 5 - i; // 5=最早, 0=本周
    const from = addDays(today, -(w * 7 + 6));
    const to = addDays(today, -(w * 7));
    let met = 0;
    for (let k = 0; k < 7; k++) {
      const d = addDays(from, k);
      if (isDayMet(m.rule, entries, d)) met++;
    }
    return { label: w === 0 ? "本周" : `${w} 周前`, met };
  });

  /* 原始值（不只达标率）—— 横看看不出来的东西 */
  const raws = entries
    .filter((e) => e.ruleId === m.rule.id && e.value != null)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-6);

  /* 这一段里发生了什么：规则改动叠在流上（否则看不出因果） */
  const marks = rules
    .filter((r) => r.kind === "period" && (r.mentions ?? []).includes(m.rule.id))
    .map((r) => `「${r.title}」开始于 ${r.start ?? "—"}`);

  const trend =
    weeks.length >= 2 && weeks[0].met > weeks[weeks.length - 1].met
      ? "在变好"
      : weeks.length >= 2 && weeks[0].met < weeks[weeks.length - 1].met
        ? "在变坏"
        : "大致持平";

  return (
    <div className="card" style={{ borderColor: "var(--brand)" }}>
      <div className="row--between">
        <span className="t-bold">{m.rule.title} · 点开看</span>
        <button className="btn btn--sm btn--ghost" onClick={onClose}>
          收起
        </button>
      </div>

      <div className="card--inset" style={{ marginTop: 10 }}>
        <div className="t-cap t-faint">这一条在怎么变</div>
        <div className="t-h2" style={{ marginTop: 2 }}>
          {trend}
        </div>
        <div className="t-cap t-mut">
          近 30 天 {m.metDays}/{m.windowDays} · {rate(m.rate)}
          {m.maxGap >= 5 ? ` · 最长断 ${m.maxGap} 天` : ""}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="t-bold t-sm">按周达标</div>
        <div className="list" style={{ marginTop: 6 }}>
          {weeks.map((w) => (
            <div className="list__row" key={w.label}>
              <div className="row--between">
                <span className="t-sm t-mut">{w.label}</span>
                <span className="t-cap t-num">{w.met}/7</span>
              </div>
              <div className="bar" style={{ marginTop: 4 }}>
                <i className="bar__fill" style={{ width: `${(w.met / 7) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {raws.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="t-bold t-sm">原始值（不是达标率）</div>
          <div className="list" style={{ marginTop: 6 }}>
            {raws.map((e) => (
              <div className="list__row" key={e.id}>
                <div className="row--between">
                  <span className="t-sm t-mut t-num">{e.date.slice(5)}</span>
                  <span className="t-sm t-num">
                    {e.value}
                    {e.unit ?? ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="note" style={{ marginTop: 8 }}>
            达标率可能还好看，但<b>原始值在漂</b> —— 这是横看看不出来的。
          </div>
        </div>
      ) : null}

      {marks.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="t-bold t-sm">这一段里发生了什么</div>
          <div className="list" style={{ marginTop: 6 }}>
            {marks.map((x) => (
              <div className="list__row t-sm t-mut" key={x}>
                {x}
              </div>
            ))}
          </div>
          <div className="t-cap t-faint" style={{ marginTop: 6 }}>
            把「规则改动」叠在流上，否则看不出因果
          </div>
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn btn--sm btn--primary" href="/future">
          去调它
        </Link>
      </div>
    </div>
  );
}

export default function PastPage() {
  const state = useData();
  const [drill, setDrill] = useState<string | null>(null);
  const [cut, setCut] = useState<"rule" | "period" | "time">("rule");

  if (state.status === "loading") {
    return (
      <main className="stack">
        <div className="hint">正在准备…</div>
      </main>
    );
  }

  const { rules, entries, openProposals } = state.data;
  const today = todayDate();
  const groups = groupAll(rules, entries, today);
  const periods = rules.filter((r) => r.kind === "period");
  const drillM = drill ? metricsOf(rules.find((r) => r.id === drill)!, entries, today) : null;

  const reviewProposal = openProposals.find((p) => p.kind === "review-rhythm");

  const groupsBlock = (
    <>
      {groups.solid.length ? (
        <section className="card">
          <div className="row--between">
            <span className="t-bold">稳了</span>
            <span className="t-cap t-faint">{groups.solid.length} 条</span>
          </div>
          <div className="list" style={{ marginTop: 6 }}>
            {groups.solid.map((m) => (
              <RuleRow
                key={m.rule.id}
                m={m}
                entries={entries}
                today={today}
                onDrill={() => setDrill(m.rule.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.slipping.length ? (
        <section className="card">
          <div className="row--between">
            <span className="t-bold">掉了</span>
            <span className="t-cap t-faint">{groups.slipping.length} 条</span>
          </div>
          <div className="list" style={{ marginTop: 6 }}>
            {groups.slipping.map((m) => (
              <div className="list__row" key={m.rule.id}>
                <div className="row--between">
                  <span className="t-sm">{m.rule.title}</span>
                  <span className="t-cap t-num t-mut">
                    {m.metDays}/{m.windowDays} · {rate(m.rate)}
                  </span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <DotStrip days={stripOf(m.rule, entries, today)} />
                </div>
                <p className="t-cap t-mut" style={{ marginTop: 6 }}>
                  {whySlipping(m)}
                </p>
                <div className="row" style={{ marginTop: 6 }}>
                  <Link className="btn btn--sm btn--primary" href="/future">
                    去调它
                  </Link>
                  <button className="btn btn--sm" onClick={() => setDrill(m.rule.id)}>
                    点开这一条 ›
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {groups.stale.length ? (
        <section className="card">
          <div className="row--between">
            <span className="t-bold">没动</span>
            <span className="t-cap t-faint">{groups.stale.length} 条</span>
          </div>
          <div className="list" style={{ marginTop: 6 }}>
            {groups.stale.map((m) => (
              <div className="list__row" key={m.rule.id}>
                <div className="row--between">
                  <span className="t-sm">{m.rule.title}</span>
                  <span className="t-cap t-faint">
                    {m.idleDays != null ? `${m.idleDays} 天没记` : "从没记过"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="note" style={{ marginTop: 8 }}>
            「没动」不是失败，是<b>线索</b>：要么这条不该养，要么入口太远。
          </div>
        </section>
      ) : null}
    </>
  );

  const periodsBlock = (
    <>
      {periods.length === 0 ? (
        <div className="hint">还没有声明过时期。</div>
      ) : (
        periods.map((p) => {
          const s = periodSummary(p, rules, entries, today);
          return (
            <section className="card" key={p.id} style={{ borderStyle: "dashed" }}>
              <div className="row--between">
                <span className="t-bold">{p.title}</span>
                <span className="tag tag--grow">多因素目标</span>
              </div>
              <p className="t-cap t-faint" style={{ marginTop: 4 }}>
                {p.start} → {p.end}
                {p.periodGoal ? ` · ${p.periodGoal}` : ""}
              </p>

              {/* 已定：不做平均，报瓶颈 */}
              {s.bottleneck ? (
                <div className="card--inset" style={{ marginTop: 10 }}>
                  <div className="t-cap t-faint">现在卡在</div>
                  <div className="t-h2" style={{ marginTop: 2 }}>
                    {s.bottleneck.rule.title}
                  </div>
                  <div className="t-cap t-mut">
                    睡眠 {rate(s.mentioned[0]?.rate ?? 0)} · 专注 {rate(s.mentioned[1]?.rate ?? 0)} · 学习{" "}
                    {rate(s.mentioned[2]?.rate ?? 0)}
                  </div>
                </div>
              ) : null}

              <div className="list" style={{ marginTop: 8 }}>
                {s.mentioned.map((m) => (
                  <div className="list__row" key={m.rule.id}>
                    <div className="row--between">
                      <span className="t-sm">
                        {m.rule.title}
                        {p.tempTargets?.[m.rule.id] != null ? (
                          <span className="t-cap t-faint">
                            {" "}
                            （临时 {p.tempTargets[m.rule.id]}
                            {m.rule.unit ?? ""}）
                          </span>
                        ) : null}
                      </span>
                      <span className="t-cap t-num t-mut">
                        {m.metDays}/{m.windowDays}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="note" style={{ marginTop: 8 }}>
                进度不来自勾选任务，来自这几条并行规则的合力。
                <b>不做平均，报瓶颈</b> —— 瓶颈可行动，平均值不可行动。
              </div>
            </section>
          );
        })
      )}
    </>
  );

  /* 按时间：近 6 周，每周一条摘要 */
  const timeBlock = (
    <section className="card">
      <div className="t-bold">近 6 周</div>
      <div className="list" style={{ marginTop: 6 }}>
        {Array.from({ length: 6 }, (_, i) => {
          const w = 5 - i;
          const from = addDays(today, -(w * 7 + 6));
          const to = addDays(today, -(w * 7));
          const list = entries.filter((e) => e.date >= from && e.date <= to);
          const days = new Set(list.map((e) => e.date)).size;
          return (
            <div className="list__row" key={from}>
              <div className="row--between">
                <span className="t-sm t-num t-mut">
                  {from.slice(5)} – {to.slice(5)}
                </span>
                <span className="t-cap t-num">
                  {list.length} 条 · {days}/7 天有记
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <>
      <main className="stack">
        <div className="row--between">
          <span className="t-h3">回看</span>
          <SyncDot label="只读" />
        </div>

        {reviewProposal ? <ProposalCard p={reviewProposal} /> : null}

        <div className="segs">
          {(
            [
              ["rule", "按规则"],
              ["period", "按时期"],
              ["time", "按时间"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={`pill${cut === k ? " pill--on" : ""}`}
              onClick={() => setCut(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {drillM ? (
          <Drill
            m={drillM}
            entries={entries}
            today={today}
            rules={rules}
            onClose={() => setDrill(null)}
          />
        ) : null}

        {cut === "rule" ? groupsBlock : cut === "period" ? periodsBlock : timeBlock}
      </main>

      <aside className="shell__aside">
        <div className="card card--quiet">
          <div className="t-bold t-sm">三种切法</div>
          <div className="list" style={{ marginTop: 6 }}>
            <div className="list__row t-sm t-mut">按承诺 / 按时期 / 按时间</div>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            回看是<b>只读</b>的。每个结论旁只给一个出口「去调它」→ 跳到「往后」。
          </div>
        </div>

        {groups.others.length ? (
          <div className="card card--quiet" style={{ marginTop: 12 }}>
            <div className="t-bold t-sm">暂停 / 归档</div>
            <div className="list" style={{ marginTop: 6 }}>
              {groups.others.map((m) => (
                <div className="list__row" key={m.rule.id}>
                  <div className="row--between">
                    <span className="t-sm">{m.rule.title}</span>
                    <span className="t-cap t-faint">
                      {m.rule.state === "paused" ? "暂停" : "归档"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
