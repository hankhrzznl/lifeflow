/**
 * 时间冲突检测引擎 — 纯函数，不依赖任何 React/Next.js
 */

export interface ConflictItem {
  id: string;
  date: string;
  plannedStart: string; // "HH:MM"
  plannedEnd: string;   // "HH:MM"
  title?: string;
}

export interface TimeConflict {
  a: ConflictItem;
  b: ConflictItem;
  date: string;
  overlapStart: string;
  overlapEnd: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 检测两个时间段是否重叠（含端点相等 → 不视为重叠）
 */
function isOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && aE > bS;
}

/**
 * 计算重叠区间
 */
function overlapRange(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  const oS = Math.max(aS, bS);
  const oE = Math.min(aE, bE);
  return {
    start: `${String(Math.floor(oS / 60)).padStart(2, '0')}:${String(oS % 60).padStart(2, '0')}`,
    end: `${String(Math.floor(oE / 60)).padStart(2, '0')}:${String(oE % 60).padStart(2, '0')}`,
  };
}

/**
 * 检测一组 Item 中的时间重叠
 * 按 date 分组后检测同一天的冲突
 */
export function detectTimeConflicts(items: ConflictItem[]): TimeConflict[] {
  const conflicts: TimeConflict[] = [];

  // 按 date 分组
  const groups = new Map<string, ConflictItem[]>();
  for (const item of items) {
    if (!item.plannedStart || !item.plannedEnd) continue;
    const list = groups.get(item.date) || [];
    list.push(item);
    groups.set(item.date, list);
  }

  for (const [, dayItems] of groups) {
    for (let i = 0; i < dayItems.length; i++) {
      for (let j = i + 1; j < dayItems.length; j++) {
        const a = dayItems[i];
        const b = dayItems[j];
        if (isOverlap(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd)) {
          const range = overlapRange(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd);
          conflicts.push({ a, b, date: a.date, overlapStart: range.start, overlapEnd: range.end });
        }
      }
    }
  }

  return conflicts;
}

/**
 * 检查给定的新时间段是否与已有列表冲突
 */
export function checkNewConflict(
  newItem: ConflictItem,
  existing: ConflictItem[],
): TimeConflict | null {
  for (const ex of existing) {
    if (ex.date !== newItem.date) continue;
    if (isOverlap(newItem.plannedStart, newItem.plannedEnd, ex.plannedStart, ex.plannedEnd)) {
      const range = overlapRange(newItem.plannedStart, newItem.plannedEnd, ex.plannedStart, ex.plannedEnd);
      return { a: newItem, b: ex, date: newItem.date, overlapStart: range.start, overlapEnd: range.end };
    }
  }
  return null;
}
