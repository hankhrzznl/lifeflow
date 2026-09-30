"use client";

/**
 * 界面 02 · 今天（时间姿态：此刻）
 * 定稿 §3.1 C2：把规则变成「此刻的这一件」—— **不只显示，要唯一指定**
 *
 * 一屏只有三块：
 *   ① 系统提议（可选，一天最多一条）
 *   ② 唯一的一件（第一屏的主角）
 *   ③ 今天其余（收起）
 * 没有"今天全部待办"——候选太多本身就是痛点
 */

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/useData";
import { entriesOfDay, isDayMet, metricsOf, pickTheOne } from "@/lib/metrics";
import { todayDate } from "@/lib/db";
import { SyncDot, EntryRow, rate } from "@/components/Parts";
import { ProposalCard } from "@/components/ProposalCard";
import { QuickSheet } from "@/components/QuickSheet";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function dateLabel(): string {
  const d = new Date();
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${WEEKDAYS[d.getDay()]}`;
}

export default function TodayPage() {
  const state = useData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (state.status === "loading") {
    return (
      <>
        <main className="stack">
          <div className="hint">正在准备…</div>
        </main>
      </>
    );
  }

  const { rules, entries, openProposals } = state.data;
  const today = todayDate();
  const theOne = pickTheOne(rules, entries, today);
  const todayEntries = entriesOfDay(entries, today);

  /* 今天其余：在养、且今天还没达标的（不含主角）*/
  const others = rules
    .filter((r) => r.state === "growing" && r.kind !== "period" && r.kind !== "setting")
    .filter((r) => r.id !== theOne?.rule.id)
    .map((r) => ({ r, met: isDayMet(r, entries, today), m: metricsOf(r, entries, today) }))
    .filter((x) => !x.met);

  const doneCount = rules
    .filter((r) => r.state === "growing" && r.kind !== "period" && r.kind !== "setting")
    .filter((r) => isDayMet(r, entries, today)).length;

  const proposal = openProposals[0];

  return (
    <>
      <main className="stack">
        <div className="row--between">
          <span className="t-sm t-mut">{dateLabel()}</span>
          <SyncDot />
        </div>

        {proposal ? <ProposalCard p={proposal} /> : null}

        {theOne ? (
          <section className="hero" aria-label="现在要做的">
            <div className="hero__eyebrow">现在要做的，就这一件</div>
            <h1 className="hero__title">{theOne.rule.title}</h1>
            <p className="hero__sub">
              {theOne.why}
              {theOne.rule.target != null
                ? ` · 标准 ${theOne.rule.target}${theOne.rule.unit ?? ""}`
                : ""}
            </p>
            <div className="bar" style={{ marginTop: 14 }}>
              <i
                className="bar__fill"
                style={{ width: `${Math.round(theOne.metrics.rate * 100)}%` }}
              />
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                onClick={() => setSheetOpen(true)}
              >
                记一下
              </button>
            </div>
          </section>
        ) : (
          <section className="card">
            <div className="t-h2">还没有在养的规则</div>
            <p className="t-sm t-mut" style={{ marginTop: 6 }}>
              去「往后」加一条 —— 或者等系统从你的记录里提一个。
            </p>
            <Link className="btn btn--primary" style={{ marginTop: 12 }} href="/future">
              去往后
            </Link>
          </section>
        )}

        <section className="card card--quiet">
          <button
            type="button"
            className="row--between"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="t-bold t-sm">
              今天还有 {others.length} 件
            </span>
            <span className="t-cap t-faint">{expanded ? "收起" : "展开"}</span>
          </button>
          {expanded ? (
            <>
              <div className="list" style={{ marginTop: 8 }}>
                {others.length === 0 ? (
                  <p className="t-cap t-mut">在养的都达标了。</p>
                ) : (
                  others.map(({ r, m }) => (
                    <div className="list__row" key={r.id}>
                      <div className="row--between">
                        <span className="t-sm">{r.title}</span>
                        <span className="t-cap t-num t-mut">
                          {m.metDays}/{m.windowDays} · {rate(m.rate)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="t-cap t-faint" style={{ marginTop: 8 }}>
                今天已达标 {doneCount} 条
              </p>
            </>
          ) : null}
        </section>

        {/* 手机上也给一眼今天的流（桌面另有右栏）*/}
        <section className="card card--quiet">
          <div className="row--between">
            <span className="t-bold t-sm">今天记了 {todayEntries.length} 条</span>
            <Link className="t-cap" href="/log" style={{ color: "var(--brand)" }}>
              全部
            </Link>
          </div>
          {todayEntries.length ? (
            <div className="list" style={{ marginTop: 6 }}>
              {todayEntries.slice(-6).reverse().map((e) => (
                <EntryRow key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <p className="t-cap t-mut" style={{ marginTop: 6 }}>
              今天还没有记录。
            </p>
          )}
        </section>
      </main>

      {/* 平板/电脑：右栏 = 今天的流（定稿 §6 三档深度）*/}
      <aside className="shell__aside">
        <div className="card">
          <div className="row--between">
            <span className="t-bold t-sm">今天的流</span>
            <Link className="t-cap t-faint" href="/log">
              记一笔
            </Link>
          </div>
          {todayEntries.length ? (
            <div className="list" style={{ marginTop: 6 }}>
              {[...todayEntries].reverse().map((e) => (
                <EntryRow key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <p className="t-cap t-mut" style={{ marginTop: 6 }}>
              今天还没有记录。
            </p>
          )}
        </div>
      </aside>

      <QuickSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultRuleId={theOne?.rule.id}
      />
    </>
  );
}
