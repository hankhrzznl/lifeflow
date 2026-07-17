import { db } from "@/lib/db";

const TABLE_NAME = "migrationMarkers";

export async function hasMigrationMarker(key: string): Promise<boolean> {
  try {
    const table = db.table(TABLE_NAME);
    const record = await table.where("key").equals(key).first();
    return !!record;
  } catch {
    return false;
  }
}

export async function setMigrationMarker(key: string): Promise<void> {
  try {
    const table = db.table(TABLE_NAME);
    const existing = await table.where("key").equals(key).first();
    if (!existing) {
      await table.put({ key, executedAt: new Date().toISOString() });
    }
  } catch { /* 失败不阻塞 */ }
}
