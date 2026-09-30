"use client";

/**
 * 界面 05 · 工具（走 B —— 定稿 §8.2 决定 3）
 *
 * **工具不是"另一个世界"，它就是带标签的同一条流，加一个筛选视图。**
 *
 * 依据：记账的数据形状就是流 ——
 *   金额＝"值"、分类＝"标签"、预算＝一条规则（走「往后」）、月度报表＝按标签聚合。
 * A1 说所有数据最终都落回同一条流。
 *
 * ⚠ 边界：复式记账 / 对账 / 余额勾稽超出 B 的能力范围（那是另一个产品）。
 */

import { useMemo, useState } from "react";
import { useData } from "@/lib/useData";
import type { EntryDoc } from "@/lib/db";
import { EntryRow, SyncDot } from "@/components/Parts";

function sum(list: EntryDoc[]): number {
  return list.reduce((a, e) => a + (e.value ?? 0), 0);
}

export default function ToolsPage() {
  const state = useData();
  const [active, setActive] = useState<string | null>(null);

  const entries = state.status === "ready" ? state.data.entries : [];
  const toolViews = state.status === "ready" ? state.data.toolViews : [];

  const current = active ?? toolViews[0]?.id ?? null;
  const view = toolViews.find((v) => v.id === current) ?? null;

  const list = useMemo(
    () =>
      view
        ? entries
            .filter((e) => (e.tags ?? []).includes(view.tag))
            .sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [entries, view],
  );

  if (state.status === "loading") {
    return (
      <main className="stack">
        <div className="hint">正在准备…</div>
      </main>
    );
  }

  const isExpense = view?.tag === "记账";
  const out = list.filter((e) => e.sign === "out");
  const inn = list.filter((e) => e.sign === "in");

  return (
    <>
      <main className="stack">
        <div className="row--between">
          <span className="t-h3">工具</span>
          <SyncDot label="＝ 标签 + 视图" />
        </div>

        <section className="card card--dashed">
          <div className="t-bold t-sm">工具不是&ldquo;另一个世界&rdquo;</div>
          <p className="t-cap t-mut" style={{ marginTop: 4 }}>
            它就是带标签的<b>同一条流</b>，加一个筛选视图。与「今天」是同一批数据。
          </p>
        </section>

        <div className="segs">
          {toolViews.map((v) => (
            <button
              key={v.id}
              className={`pill${current === v.id ? " pill--on" : ""}`}
              onClick={() => setActive(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>

        {view ? (
          <section className="card">
            <div className="row--between">
              <span className="t-bold">带「{view.name}」标签的流</span>
              <span className="t-cap t-faint">{list.length} 条</span>
            </div>

            {isExpense ? (
              <div className="card--inset" style={{ marginTop: 10 }}>
                <div className="t-cap t-faint">合计（按标签聚合，不是新实体）</div>
                <div className="t-h1 t-num" style={{ marginTop: 2 }}>
                  {sum(out) - sum(inn)}
                  <span className="t-sm t-mut"> 元</span>
                </div>
                <div className="t-cap t-mut">
                  支出 {sum(out)} · 收入 {sum(inn)}
                </div>
              </div>
            ) : null}

            {list.length ? (
              <div className="list" style={{ marginTop: 8 }}>
                {list.slice(0, 40).map((e) => (
                  <EntryRow key={e.id} e={e} />
                ))}
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 8 }}>
                还没有带「{view.name}」标签的记录。去「记一笔」点一下就有了。
              </div>
            )}

            <div className="note" style={{ marginTop: 10 }}>
              与「今天」那一屏是<b>同一批数据</b>，只是筛了标签 —— 不是第二份记录。
            </div>
          </section>
        ) : (
          <div className="hint">还没有工具视图。</div>
        )}

        <section className="card">
          <div className="t-bold t-sm">工具特有的东西放哪</div>
          <div className="list" style={{ marginTop: 6 }}>
            <div className="list__row t-sm t-mut">金额 / 账户 → 流上的字段</div>
            <div className="list__row t-sm t-mut">预算 → 一条规则（走「往后」）</div>
            <div className="list__row t-sm t-mut">倒数日的日期 → 一条规则（有跨度）</div>
            <div className="list__row t-sm t-mut">重要的人的节奏 → 一条规则</div>
          </div>
          <p className="t-cap t-faint" style={{ marginTop: 6 }}>
            都不是新实体 —— A1 说：流 + 规则就够
          </p>
        </section>
      </main>

      <aside className="shell__aside">
        <div className="card card--quiet">
          <div className="t-bold t-sm">为什么不做成四个小世界</div>
          <p className="t-cap t-mut" style={{ marginTop: 6 }}>
            你原来的话：「工具太多且互不相通 —— 每个 app 都要单独看一遍」。
            把四个工具各做成一个独立世界，本质就是<b>把四个 app 摆在一起</b>。
          </p>
          <div className="note note--warn" style={{ marginTop: 10 }}>
            <b>边界：</b>复式记账 / 对账 / 余额勾稽超出这条路的能力范围 —— 那是另一个产品。
          </div>
        </div>

        {isExpense && list.length ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="t-bold t-sm">按账户</div>
            <div className="list" style={{ marginTop: 6 }}>
              {Object.entries(
                list.reduce<Record<string, number>>((acc, e) => {
                  const k = e.account ?? "未标";
                  acc[k] = (acc[k] ?? 0) + (e.value ?? 0);
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div className="list__row row--between" key={k}>
                    <span className="t-sm">{k}</span>
                    <span className="t-cap t-num">{v}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
