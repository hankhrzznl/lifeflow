// ============================================================
// 记账子站设置持久化（localStorage，免 DB 迁移）
// ============================================================

const STORE_KEY = "lifeflow_accounting_settings";

interface AccountingSettings {
  hideZeroCategory: boolean;
  weeklyStats: boolean;
}

function load(): AccountingSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as AccountingSettings;
  } catch { /* ignore */ }
  return { hideZeroCategory: false, weeklyStats: false };
}

function save(s: AccountingSettings): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

export function getAccountingSetting<K extends keyof AccountingSettings>(
  key: K,
): AccountingSettings[K] {
  return load()[key];
}

export function setAccountingSetting<K extends keyof AccountingSettings>(
  key: K,
  value: AccountingSettings[K],
): void {
  const s = load();
  s[key] = value;
  save(s);
}

export function getAllAccountingSettings(): AccountingSettings {
  return load();
}
