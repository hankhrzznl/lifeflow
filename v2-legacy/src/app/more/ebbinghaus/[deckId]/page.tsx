"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, ChevronRight, Plus, Trash2, Settings, Check, X,
  RotateCcw, List, BookOpen,
} from "lucide-react";
import {
  getDeck, getDueCardsByDeck, getCardsByDeck, addCard, addCards,
  deleteCard, updateDeck, addReviewLog, calcNextReviewDate,
  DEFAULT_CURVE, ebbinghausDB,
} from "@/lib/db/ebbinghaus.db";
import type { Card, Deck, CurveConfig } from "@/lib/db/ebbinghaus.db";

// ─── 子组件：翻卡复习 ─────────────────────────────────────────

function FlipCard({
  card,
  onRemembered,
  onForgot,
}: {
  card: Card;
  onRemembered: () => void;
  onForgot: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  // 切换卡片时重置翻转状态
  useEffect(() => {
    setFlipped(false);
  }, [card.id]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4">
      {/* 轮次指示 */}
      <p className="text-[12px] font-medium mb-4" style={{ color: "var(--color-text-disabled)" }}>
        第 {card.currentRound + 1} 轮复习
      </p>

      {/* 卡片 */}
      <div
        className="w-full max-w-xs cursor-pointer select-none"
        style={{ perspective: 1000 }}
        onClick={() => setFlipped(!flipped)}
      >
        <motion.div
          className="relative w-full"
          style={{ minHeight: 220, transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
        >
          {/* 正面 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl"
            style={{
              backfaceVisibility: "hidden",
              background: "var(--color-surface-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <p className="text-[11px] font-medium mb-3" style={{ color: "var(--color-text-disabled)" }}>
              点击翻转
            </p>
            <p className="text-[17px] font-semibold text-center leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
              {card.front}
            </p>
          </div>

          {/* 背面 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "var(--lifeflow-brand-50)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <p className="text-[11px] font-medium mb-3" style={{ color: "var(--color-text-disabled)" }}>
              答案
            </p>
            <p className="text-[15px] text-center leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
              {card.back}
            </p>
          </div>
        </motion.div>
      </div>

      {/* 操作按钮（翻面后才显示） */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            className="flex gap-4 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onForgot(); }}
              className="px-6 py-3 rounded-xl text-[14px] font-semibold text-white"
              style={{ background: "#FF3B30" }}
            >
              没记住
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemembered(); }}
              className="px-6 py-3 rounded-xl text-[14px] font-semibold text-white"
              style={{ background: "#34C759" }}
            >
              记住了
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 子组件：曲线配置弹窗 ─────────────────────────────────────

function CurveConfigDialog({
  deck,
  onClose,
}: {
  deck: Deck;
  onClose: () => void;
}) {
  const [rounds, setRounds] = useState<{ interval: number }[]>(
    deck.curveConfig.rounds.map(r => ({ ...r }))
  );

  const handleUpdate = useCallback(async () => {
    const filtered = rounds.filter(r => r.interval >= 0);
    if (filtered.length < 2) return; // 至少 2 轮
    await updateDeck(deck.id, { curveConfig: { rounds: filtered } });
    onClose();
  }, [deck.id, rounds, onClose]);

  const addRound = () => {
    const last = rounds[rounds.length - 1];
    const nextInterval = last ? last.interval + 7 : 30;
    setRounds([...rounds, { interval: nextInterval }]);
  };

  const removeLastRound = () => {
    if (rounds.length <= 2) return;
    setRounds(rounds.slice(0, -1));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: "var(--color-surface-card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>
            复习曲线配置
          </h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
            <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
          </button>
        </div>

        <p className="text-[11px] mb-3" style={{ color: "var(--color-text-disabled)" }}>
          修改仅对新复习生效，已排期的卡片不受影响
        </p>

        {/* 轮次列表 */}
        <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
          {rounds.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <span className="text-[12px] font-medium w-14 shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                {i === 0 ? "首次" : `第 ${i} 轮`}
              </span>
              <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>间隔</span>
              <input
                type="number"
                min={0}
                value={r.interval}
                onChange={(e) => {
                  const newRounds = [...rounds];
                  newRounds[i] = { interval: Math.max(0, parseInt(e.target.value) || 0) };
                  setRounds(newRounds);
                }}
                className="w-16 py-1 rounded-lg text-center text-[13px] font-medium outline-none"
                style={{ background: "var(--color-surface-card)", color: "var(--color-text-primary)" }}
              />
              <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>天</span>
            </div>
          ))}
        </div>

        {/* 增减按钮 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={addRound}
            className="flex-1 py-2 rounded-xl text-[12px] font-medium flex items-center justify-center gap-1"
            style={{ background: "var(--lifeflow-muted)", color: "var(--lifeflow-primary)" }}
          >
            <Plus className="w-3.5 h-3.5" /> 添加轮次
          </button>
          <button
            onClick={removeLastRound}
            disabled={rounds.length <= 2}
            className="flex-1 py-2 rounded-xl text-[12px] font-medium disabled:opacity-30"
            style={{ background: "var(--lifeflow-muted)", color: "#FF3B30" }}
          >
            删除尾轮
          </button>
          <button
            onClick={() => setRounds(DEFAULT_CURVE.rounds.map(r => ({ ...r })))}
            className="flex-1 py-2 rounded-xl text-[12px] font-medium"
            style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
          >
            恢复默认
          </button>
        </div>

        <button
          onClick={handleUpdate}
          className="w-full py-2.5 rounded-xl text-[14px] font-semibold text-white"
          style={{ background: "var(--lifeflow-primary)" }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────

export default function DeckDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;

  const [tab, setTab] = useState<'review' | 'cards'>('review');
  const [showCurveConfig, setShowCurveConfig] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [addFront, setAddFront] = useState("");
  const [addBack, setAddBack] = useState("");
  const [adding, setAdding] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const deck = useLiveQuery(() => getDeck(deckId), [deckId]);
  const dueCards = useLiveQuery(() => getDueCardsByDeck(deckId), [deckId], []);
  const allCards = useLiveQuery(() => getCardsByDeck(deckId), [deckId], []);

  // ─── 今日复习队列 ─────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentCard = dueCards.length > 0 && currentIndex < dueCards.length
    ? dueCards[currentIndex] : null;
  const isLastCard = currentIndex >= dueCards.length - 1;

  // 加载或刷新时重置
  useEffect(() => {
    if (dueCards.length > 0 && currentIndex >= dueCards.length) {
      setCurrentIndex(0);
    }
  }, [dueCards.length]);

  // ─── 复习操作 ─────────────────────────────────────────────
  const handleReview = useCallback(async (result: 'remembered' | 'forgot') => {
    if (!currentCard || !deck) return;
    const { nextRound, nextReviewDate, mastered } = calcNextReviewDate(
      deck.curveConfig,
      currentCard.currentRound,
      result,
    );
    // 更新卡片
    await ebbinghausDB.cards.update(currentCard.id, {
      currentRound: nextRound,
      nextReviewDate,
      mastered,
    });
    // 记录日志
    await addReviewLog({
      cardId: currentCard.id,
      round: currentCard.currentRound,
      result,
      reviewedAt: Date.now(),
    });
    // 下一张
    if (isLastCard) {
      setReviewDone(true);
      // 短暂延迟后重置，展现"已完成"状态
      setTimeout(() => {
        setReviewDone(false);
        setCurrentIndex(0);
      }, 2000);
    } else {
      setCurrentIndex(i => i + 1);
    }
  }, [currentCard, deck, isLastCard]);

  // ─── 批量添加切换 ─────────────────────────────────────────
  const [batchMode, setBatchMode] = useState(false);

  const handleAddCards = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      if (batchMode) {
        // 批量：每行 "正面 | 背面"
        const lines = batchInput.trim().split('\n').filter(Boolean);
        const newCards: Omit<Card, 'id' | 'createdAt'>[] = [];
        for (const line of lines) {
          const sep = line.includes('|') ? '|' : '\t';
          const parts = line.split(sep);
          if (parts.length >= 2) {
            newCards.push({
              deckId,
              front: parts[0].trim(),
              back: parts.slice(1).join(sep).trim(),
              currentRound: 0,
              nextReviewDate: dateStr(new Date()),
              mastered: false,
            });
          }
        }
        if (newCards.length > 0) {
          await addCards(newCards);
        }
        setBatchInput("");
      } else {
        // 单条
        if (!addFront.trim() || !addBack.trim()) return;
        await addCard({
          deckId,
          front: addFront.trim(),
          back: addBack.trim(),
          currentRound: 0,
          nextReviewDate: dateStr(new Date()),
          mastered: false,
        });
        setAddFront("");
        setAddBack("");
      }
      setShowAddCard(false);
      setBatchMode(false);
    } finally {
      setAdding(false);
    }
  }, [deckId, addFront, addBack, batchInput, batchMode, adding]);

  if (!deck) {
    return (
      <div className="mx-auto min-h-screen flex items-center justify-center" style={{ maxWidth: 430, background: "var(--lifeflow-background)" }}>
        <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>加载中…</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex flex-col h-screen"
      style={{
        maxWidth: 430,
        background: "var(--lifeflow-background)",
      }}
    >
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--lifeflow-muted)" }}
            aria-label="返回"
          >
            <ChevronRight className="w-5 h-5 rotate-180" style={{ color: "var(--color-text-secondary)" }} />
          </button>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>
              {deck.name}
            </h1>
            <p className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
              {dueCards.length > 0 ? `${dueCards.length} 张待复习` : "今日无待复习"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCurveConfig(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: "var(--lifeflow-muted)" }}
          aria-label="曲线配置"
        >
          <Settings className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
        </button>
      </div>

      {/* ─── Tab 切换 ────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-2">
        <div className="flex rounded-xl p-1" style={{ background: "var(--lifeflow-muted)" }}>
          <button
            onClick={() => setTab('review')}
            className="flex-1 py-2 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: tab === 'review' ? "var(--color-surface-card)" : "transparent",
              color: tab === 'review' ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              boxShadow: tab === 'review' ? "var(--shadow-card)" : "none",
            }}
          >
            <BookOpen className="w-4 h-4" />
            今日复习
          </button>
          <button
            onClick={() => setTab('cards')}
            className="flex-1 py-2 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: tab === 'cards' ? "var(--color-surface-card)" : "transparent",
              color: tab === 'cards' ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              boxShadow: tab === 'cards' ? "var(--shadow-card)" : "none",
            }}
          >
            <List className="w-4 h-4" />
            所有卡片
          </button>
        </div>
      </div>

      {/* ─── 内容区 ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-4">
        {tab === 'review' && (
          <>
            {reviewDone || (dueCards.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "var(--lifeflow-brand-50)" }}
                >
                  {reviewDone ? (
                    <Check className="w-8 h-8" style={{ color: "#34C759" }} />
                  ) : (
                    <Brain className="w-8 h-8" style={{ color: "var(--color-text-disabled)" }} />
                  )}
                </div>
                <p className="text-[17px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {reviewDone ? "今日复习完成！" : "今日无待复习"}
                </p>
                <p className="text-[12px] mt-1 text-center" style={{ color: "var(--color-text-secondary)" }}>
                  {reviewDone
                    ? "按遗忘曲线自动安排下一次复习"
                    : "添加卡片后自动按艾宾浩斯曲线安排复习"}
                </p>
              </div>
            ) : currentCard ? (
              <FlipCard
                key={currentCard.id}
                card={currentCard}
                onRemembered={() => handleReview('remembered')}
                onForgot={() => handleReview('forgot')}
              />
            ) : null}

            {/* 进度指示 */}
            {dueCards.length > 0 && !reviewDone && (
              <div className="shrink-0 px-5 pb-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${((currentIndex) / dueCards.length) * 100}%`,
                        background: "var(--lifeflow-primary)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-text-disabled)" }}>
                    {currentIndex + 1} / {dueCards.length}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'cards' && (
          <div className="px-5">
            {/* 添加卡片按钮 */}
            {!showAddCard && (
              <button
                onClick={() => { setShowAddCard(true); setBatchMode(false); }}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium flex items-center justify-center gap-1.5 mb-3"
                style={{ background: "var(--lifeflow-muted)", color: "var(--lifeflow-primary)" }}
              >
                <Plus className="w-4 h-4" />
                添加卡片
              </button>
            )}

            {/* 添加卡片表单 */}
            {showAddCard && (
              <div
                className="p-4 mb-3 rounded-xl"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                {/* 单条/批量切换 */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setBatchMode(false)}
                    className="flex-1 py-1.5 rounded-lg text-[12px] font-medium"
                    style={{
                      background: !batchMode ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                      color: !batchMode ? "#fff" : "var(--color-text-secondary)",
                    }}
                  >
                    单条添加
                  </button>
                  <button
                    onClick={() => setBatchMode(true)}
                    className="flex-1 py-1.5 rounded-lg text-[12px] font-medium"
                    style={{
                      background: batchMode ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                      color: batchMode ? "#fff" : "var(--color-text-secondary)",
                    }}
                  >
                    批量粘贴
                  </button>
                </div>

                {batchMode ? (
                  <>
                    <textarea
                      placeholder={"每行一条，格式：正面 | 背面\n例如：\nabandon | v. 放弃、遗弃\nabolish | v. 废除、取消"}
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      rows={6}
                      className="w-full text-[13px] p-3 rounded-xl outline-none resize-none"
                      style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                    />
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--color-text-disabled)" }}>
                      支持 | 或制表符作为分隔符
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      placeholder="正面（问题/单词）"
                      value={addFront}
                      onChange={(e) => setAddFront(e.target.value)}
                      className="w-full text-[13px] py-2 px-3 rounded-xl outline-none"
                      style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                    />
                    <input
                      placeholder="背面（答案/释义）"
                      value={addBack}
                      onChange={(e) => setAddBack(e.target.value)}
                      className="w-full text-[13px] py-2 px-3 rounded-xl outline-none"
                      style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setShowAddCard(false); setBatchInput(""); setAddFront(""); setAddBack(""); }}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddCards}
                    disabled={adding || (batchMode ? !batchInput.trim() : !addFront.trim() || !addBack.trim())}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--lifeflow-primary)" }}
                  >
                    {adding ? "添加中…" : "添加"}
                  </button>
                </div>
              </div>
            )}

            {/* 卡片列表 */}
            <div className="space-y-2">
              {(allCards || []).length === 0 && (
                <p className="text-[13px] text-center py-10" style={{ color: "var(--color-text-disabled)" }}>
                  暂无卡片，添加后开始复习
                </p>
              )}
              {(allCards || []).map((card) => (
                <div
                  key={card.id}
                  className="p-3 rounded-xl flex items-start gap-3"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {card.front}
                    </p>
                    <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
                      {card.back}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {card.mastered ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#E8F5E9", color: "#2E7D32" }}>
                          已掌握
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: "var(--color-text-disabled)" }}>
                          第 {card.currentRound + 1} 轮 · 下次 {card.nextReviewDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full shrink-0"
                    style={{ background: "var(--lifeflow-muted)" }}
                    aria-label="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "#FF3B30" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── 曲线配置弹窗 ──────────────────────────────────── */}
      {showCurveConfig && (
        <CurveConfigDialog
          deck={deck}
          onClose={() => setShowCurveConfig(false)}
        />
      )}
    </div>
  );
}

// ─── 工具函数 ────────────────────────────────────────────────

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
