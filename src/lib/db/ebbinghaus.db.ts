import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface Deck {
  id: string;            // uuid
  name: string;
  curveConfig: CurveConfig; // JSON serialized in DB
  createdAt: number;
}

export interface CurveConfig {
  rounds: { interval: number }[];
}

export interface Card {
  id: string;            // uuid
  deckId: string;
  front: string;
  back: string;
  currentRound: number;  // 0 = 首次学习，达到 rounds.length-1 后标记完成
  nextReviewDate: string; // YYYY-MM-DD
  mastered: boolean;     // 所有轮次完成
  createdAt: number;
}

export interface ReviewLog {
  id: number;
  cardId: string;
  round: number;
  result: 'remembered' | 'forgot';
  reviewedAt: number;    // timestamp ms
}

export const DEFAULT_CURVE: CurveConfig = {
  rounds: [
    { interval: 0 },   // 首次学习
    { interval: 1 },   // 第 1 轮：1 天后
    { interval: 2 },   // 第 2 轮：2 天后
    { interval: 4 },   // 第 3 轮：4 天后
    { interval: 7 },   // 第 4 轮：7 天后
    { interval: 15 },  // 第 5 轮：15 天后
  ],
};

// ─── Database ────────────────────────────────────────────────

export class EbbinghausDB extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  reviewLogs!: Table<ReviewLog, number>;

  constructor() {
    super('LifeFlowEbbinghaus');
    this.version(1).stores({
      decks: '&id, name',
      cards: '&id, deckId, nextReviewDate, mastered',
      reviewLogs: '++id, cardId, reviewedAt',
    });
  }
}

export const ebbinghausDB = new EbbinghausDB();

// ─── Deck CRUD ───────────────────────────────────────────────

export async function addDeck(name: string, curveConfig?: CurveConfig): Promise<string> {
  const id = crypto.randomUUID();
  await ebbinghausDB.decks.add({
    id,
    name,
    curveConfig: curveConfig || DEFAULT_CURVE,
    createdAt: Date.now(),
  });
  return id;
}

export async function updateDeck(id: string, updates: Partial<Deck>): Promise<void> {
  await ebbinghausDB.decks.update(id, updates);
}

export async function deleteDeck(id: string): Promise<void> {
  // 级联删除该卡组下的所有卡片和复习记录
  const deckCards = await ebbinghausDB.cards.where('deckId').equals(id).toArray();
  const cardIds = deckCards.map(c => c.id);
  if (cardIds.length > 0) {
    await ebbinghausDB.reviewLogs.where('cardId').anyOf(cardIds).delete();
    await ebbinghausDB.cards.where('deckId').equals(id).delete();
  }
  await ebbinghausDB.decks.delete(id);
}

export async function getDecks(): Promise<Deck[]> {
  return ebbinghausDB.decks.toArray();
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return ebbinghausDB.decks.get(id);
}

export async function getDeckTodayDueCount(deckId: string): Promise<number> {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return ebbinghausDB.cards
    .where('deckId').equals(deckId)
    .filter(c => !c.mastered && c.nextReviewDate <= todayStr)
    .count();
}

// ─── Card CRUD ───────────────────────────────────────────────

export async function addCard(card: Omit<Card, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await ebbinghausDB.cards.add({ ...card, id, createdAt: Date.now() });
  return id;
}

export async function addCards(cards: Omit<Card, 'id' | 'createdAt'>[]): Promise<string[]> {
  const now = Date.now();
  const records = cards.map(c => ({ ...c, id: crypto.randomUUID(), createdAt: now }));
  await ebbinghausDB.cards.bulkAdd(records);
  return records.map(r => r.id);
}

export async function deleteCard(id: string): Promise<void> {
  await ebbinghausDB.reviewLogs.where('cardId').equals(id).delete();
  await ebbinghausDB.cards.delete(id);
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  return ebbinghausDB.cards.where('deckId').equals(deckId).toArray();
}

export async function getDueCardsByDeck(deckId: string): Promise<Card[]> {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return ebbinghausDB.cards
    .where('deckId').equals(deckId)
    .filter(c => !c.mastered && c.nextReviewDate <= todayStr)
    .toArray();
}

export async function getDeckCardCounts(deckId: string): Promise<{ total: number; mastered: number }> {
  const all = await ebbinghausDB.cards.where('deckId').equals(deckId).toArray();
  return {
    total: all.length,
    mastered: all.filter(c => c.mastered).length,
  };
}

// ─── Review Log ──────────────────────────────────────────────

export async function addReviewLog(log: Omit<ReviewLog, 'id'>): Promise<number> {
  return ebbinghausDB.reviewLogs.add(log as ReviewLog);
}

// ─── Curve helpers ───────────────────────────────────────────

export function calcNextReviewDate(
  curve: CurveConfig,
  currentRound: number,
  result: 'remembered' | 'forgot',
): { nextRound: number; nextReviewDate: string; mastered: boolean } {
  const today = new Date();

  if (result === 'forgot') {
    // 没记住 → 回到首次学习（第 0 轮）
    return {
      nextRound: 0,
      nextReviewDate: dateStr(today),
      mastered: false,
    };
  }

  // 记住了 → 进入下一轮
  const nextRound = currentRound + 1;
  if (nextRound >= curve.rounds.length) {
    // 所有轮次完成
    return {
      nextRound: curve.rounds.length - 1,
      nextReviewDate: dateStr(today),
      mastered: true,
    };
  }

  const interval = curve.rounds[nextRound].interval;
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + interval);
  return {
    nextRound,
    nextReviewDate: dateStr(nextDate),
    mastered: false,
  };
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
