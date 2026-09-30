"use client";

/**
 * 界面 01 · 记一笔（时间姿态：此刻｜唯一入口）
 * 治痛点①「忘了记」—— A6 说这是四个痛点的最上游
 *
 * 手机上：常用项 + 一句话输入 + 今天的流
 * 平板上：左栏录入 + 右栏今天的流
 * 电脑上：左栏只做「补录 / 批量修正 / 导出」，不做日常记录（依据 A3）
 */

import { useMemo, useState } from "react";
import { useData } from "@/lib/useData";
import { todayDate, addDays } from "@/lib/db";
import { softDelete } from "@/lib/write";
import { entriesOfDay } from "@/lib/metrics";
import { EntryRow, SyncDot } from "@/components/Parts";
import { QuickSheet } from "@/components/QuickSheet";

export default function LogPage() {
  const state = useData();
  const [date, setDate] = useState(todayDate());
  const [open, setOpen] = useState(false);

  const entries = state.status === "ready" ? state.data.entries : [];
  const ofDay = useMemo(() => entriesOfDay(entries, date), [entries, date]);

  async function remove(id: string) {
    /* 软删（决策 S3）：不物理删 —— 行还得上传，物理删了远端永远收不到这次删除。
       界面靠 useData 的 live() 过滤。 */
    await softDelete("entries", id);
  }

  if (state.status === "loading") {
    return (
      <main className="stack">
        <div className="hint">正在准备…</div>
      </main>
    );
  }

  const isToday = date === todayDate();

  return (
    <>
      <main className="stack">
        <div className="row--between">
          <span className="t-h3">记一笔</span>
          <SyncDot label={`${ofDay.length} 条`} />
        </div>

        <section className="card">
          <div className="row--between">
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="前一天"
            >
              ‹ 前一天
            </button>
            <span className="t-bold t-sm t-num">{date}</span>
            <button
              className="btn btn--sm btn--ghost"
              disabled={isToday}
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="后一天"
            >
              后一天 ›
            </button>
          </div>

          <button
            className="btn btn--primary btn--lg btn--block"
            style={{ marginTop: 12 }}
            onClick={() => setOpen(true)}
          >
            点一下记一笔
          </button>
          <p className="t-cap t-faint" style={{ marginTop: 8, textAlign: "center" }}>
            常用项在最上面，点一下即记
          </p>
        </section>

        <section className="card">
          <div className="row--between">
            <span className="t-bold t-sm">{isToday ? "今天" : date}</span>
            <span className="t-cap t-faint">长按行可撤</span>
          </div>
          {ofDay.length ? (
            <div className="list" style={{ marginTop: 6 }}>
              {[...ofDay].reverse().map((e) => (
                <div
                  key={e.id}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    void remove(e.id);
                  }}
                >
                  <EntryRow e={e} />
                </div>
              ))}
            </div>
          ) : (
            <div className="hint" style={{ marginTop: 8 }}>
              这一天还没有记录。
            </div>
          )}
        </section>
      </main>

      <aside className="shell__aside">
        <div className="card card--quiet">
          <div className="t-bold t-sm">电脑上更适合的</div>
          <div className="list" style={{ marginTop: 6 }}>
            <div className="list__row t-sm">批量补录（补上周的）</div>
            <div className="list__row t-sm">批量修正（记错了）</div>
            <div className="list__row t-sm">导出 / 导入</div>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            依据 A3：电脑＝改得动。日常「记一笔」不该在电脑上发生。
          </div>
        </div>
      </aside>

      <QuickSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
