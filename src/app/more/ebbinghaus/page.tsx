"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Brain, Plus, Trash2, ChevronRight } from "lucide-react";
import { getDecks, addDeck, deleteDeck, getDeckTodayDueCount, getDeckCardCounts, DEFAULT_CURVE } from "@/lib/db/ebbinghaus.db";
import type { CurveConfig } from "@/lib/db/ebbinghaus.db";

export default function EbbinghausPage() {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const decks = useLiveQuery(() => getDecks(), [], []);

  // 为每个卡组计算今日待复习数
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [cardCounts, setCardCounts] = useState<Record<string, { total: number; mastered: number }>>({});

  // 异步加载卡片数据
  useEffect(() => {
    const loadCounts = async () => {
      const all = decks || [];
      const due: Record<string, number> = {};
      const counts: Record<string, { total: number; mastered: number }> = {};
      for (const d of all) {
        due[d.id] = await getDeckTodayDueCount(d.id);
        counts[d.id] = await getDeckCardCounts(d.id);
      }
      setDueCounts(due);
      setCardCounts(counts);
    };
    loadCounts();
  }, [decks]);

  const handleCreate = useCallback(async () => {
    if (!deckName.trim() || creating) return;
    setCreating(true);
    try {
      await addDeck(deckName.trim());
      setDeckName("");
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  }, [deckName, creating]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDeck(id);
    setDeleteConfirm(null);
  }, []);

  return (
    <div
      className="mx-auto min-h-screen"
      style={{
        maxWidth: 430,
        background: "var(--lifeflow-background)",
        paddingBottom: 120,
      }}
    >
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--lifeflow-muted)" }}
            aria-label="返回"
          >
            <ChevronRight className="w-5 h-5 rotate-180" style={{ color: "var(--color-text-secondary)" }} />
          </button>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>
            记忆
          </h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: "var(--lifeflow-primary)" }}
          aria-label="新建卡组"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ─── 新建卡组 ──────────────────────────────────────── */}
      {showNew && (
        <div className="px-5 mb-4">
          <div
            className="p-4"
            style={{
              borderRadius: 16,
              background: "var(--color-surface-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <input
              autoFocus
              placeholder="卡组名称，如「英语四级」「国考」"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              className="w-full text-[15px] py-2 px-3 rounded-xl outline-none"
              style={{
                background: "var(--lifeflow-muted)",
                color: "var(--color-text-primary)",
              }}
            />
            <p className="text-[11px] mt-2" style={{ color: "var(--color-text-disabled)" }}>
              复习曲线：标准艾宾浩斯（1天 → 2天 → 4天 → 7天 → 15天），可在卡组中修改
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowNew(false); setDeckName(""); }}
                className="flex-1 py-2 rounded-xl text-[13px] font-medium"
                style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!deckName.trim() || creating}
                className="flex-1 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                {creating ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 卡组列表 ──────────────────────────────────────── */}
      <div className="px-5 space-y-3">
        {(decks || []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Brain className="w-12 h-12 mb-3" style={{ color: "var(--color-text-disabled)" }} />
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
              还没有卡组
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
              新建卡组开始记忆复习
            </p>
          </div>
        )}

        {(decks || []).map((deck) => {
          const due = dueCounts[deck.id] || 0;
          const counts = cardCounts[deck.id];
          const totalCards = counts?.total || 0;
          const masteredCards = counts?.mastered || 0;

          return (
            <div
              key={deck.id}
              className="relative overflow-hidden"
              style={{ borderRadius: 16 }}
            >
              <button
                onClick={() => router.push(`/more/ebbinghaus/${deck.id}`)}
                className="w-full text-left p-4 transition-opacity hover:opacity-90"
                style={{
                  background: "var(--color-surface-card)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--lifeflow-brand-50)" }}
                    >
                      <Brain className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {deck.name}
                      </h3>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
                        {totalCards > 0
                          ? `${totalCards} 张卡片 · 已掌握 ${masteredCards}`
                          : "暂无卡片"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {due > 0 && (
                      <span
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          background: "var(--lifeflow-primary)",
                          color: "#fff",
                        }}
                      >
                        {due} 待复习
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                  </div>
                </div>
              </button>

              {/* 删除按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(deck.id); }}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: "var(--lifeflow-muted)" }}
                aria-label="删除卡组"
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#FF3B30" }} />
              </button>

              {/* 删除确认 */}
              {deleteConfirm === deck.id && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-10"
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    borderRadius: 16,
                  }}
                >
                  <div className="px-4 py-3 rounded-xl flex items-center gap-3"
                    style={{ background: "var(--color-surface-card)" }}
                  >
                    <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      确认删除「{deck.name}」？
                    </span>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                      style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleDelete(deck.id)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                      style={{ background: "#FF3B30" }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
