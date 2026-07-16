// ============================================================
// 数据导出/导入服务
// JSON 全量导出 + CSV 目标/打卡导出 + JSON 导入恢复
// ============================================================

import { db } from '@/lib/db';
import { engineDB } from '@/lib/engine/db';
import Dexie from 'dexie';

// ============================================================
// 类型
// ============================================================

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ============================================================
// DataExportService
// ============================================================

export class DataExportService {
  /**
   * 导出所有数据为 JSON
   */
  async exportAllJSON(): Promise<string> {
    const data = {
      exportDate: new Date().toISOString(),
      version: '2.2',
      mainDB: {
        goals: await db.goals.toArray(),
        plans: await db.plans?.toArray() || [],
        tasks: await db.tasks.toArray(),
        finRecords: await db.finRecords?.toArray() || [],
        finAccounts: await db.finAccounts?.toArray() || [],
        sleepRecords: await db.sleepRecords?.toArray() || [],
        dailyWaterRecords: await db.dailyWaterRecords?.toArray() || [],
        muscleRecords: await db.muscleRecords?.toArray() || [],
      },
      engineDB: {
        goals: await engineDB.goals.toArray(),
        milestones: await engineDB.milestones.toArray(),
        weeklyTasks: await engineDB.weeklyTasks.toArray(),
        dailyAtoms: await engineDB.dailyAtoms.toArray(),
        progressSnapshots: await engineDB.progressSnapshots.toArray(),
      },
      settings: this.exportSettings(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 导出目标列表为 CSV
   */
  async exportGoalsCSV(): Promise<string> {
    const goals = await engineDB.goals.toArray();
    const headers = ['ID', '标题', '分类', '优先级', '进度', '状态', '截止日期', '创建时间'];
    const rows = goals.map((g) => [
      g.id, g.title, g.category, g.priority, String(g.progress),
      g.status, g.deadline || '', g.createdAt.slice(0, 10),
    ]);
    return [headers, ...rows].map((row) => row.map(this.escapeCSV).join(',')).join('\n');
  }

  /**
   * 导出打卡记录为 CSV
   */
  async exportCheckinsCSV(): Promise<string> {
    const atoms = await engineDB.dailyAtoms.toArray();
    const headers = ['ID', '标题', '日期', '完成', '实际量', '评分', '完成时间'];
    const rows = atoms.map((a) => [
      a.id, a.title, a.scheduledDate,
      a.isCompleted ? '是' : '否',
      String(a.actualQuantity ?? ''),
      String(a.score ?? ''),
      a.completedAt ? a.completedAt.slice(0, 10) : '',
    ]);
    return [headers, ...rows].map((row) => row.map(this.escapeCSV).join(',')).join('\n');
  }

  /**
   * 触发文件下载
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================================
  // 导入功能
  // ==========================================================

  /**
   * 从 JSON 字符串导入数据
   */
  async importFromJSON(jsonString: string): Promise<ImportResult> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonString);
    } catch {
      throw new Error('无效的 JSON 文件');
    }

    if (!data.version) {
      throw new Error('无效的备份文件：缺少版本信息');
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    // 导入主数据库
    const mainDB = (data.mainDB as Record<string, unknown[]>) || {};
    const mainTables: Array<{ name: string; table: Dexie.Table }> = [
      { name: 'goals', table: db.goals },
      { name: 'plans', table: db.plans },
      { name: 'tasks', table: db.tasks },
      { name: 'finRecords', table: db.finRecords },
      { name: 'finAccounts', table: db.finAccounts },
      { name: 'sleepRecords', table: db.sleepRecords },
      { name: 'dailyWaterRecords', table: db.dailyWaterRecords },
      { name: 'muscleRecords', table: db.muscleRecords },
    ];

    for (const { name, table } of mainTables) {
      const records = mainDB[name];
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        try {
          await table.put(record);
          result.imported++;
        } catch (e) {
          result.errors.push(`主库.${name}: ${String(e)}`);
        }
      }
    }

    // 导入引擎数据库
    const engineData = (data.engineDB as Record<string, unknown[]>) || {};
    const engineTables: Array<{ name: string; table: Dexie.Table }> = [
      { name: 'goals', table: engineDB.goals },
      { name: 'milestones', table: engineDB.milestones },
      { name: 'weeklyTasks', table: engineDB.weeklyTasks },
      { name: 'dailyAtoms', table: engineDB.dailyAtoms },
      { name: 'progressSnapshots', table: engineDB.progressSnapshots },
    ];

    for (const { name, table } of engineTables) {
      const records = engineData[name];
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        try {
          await table.put(record);
          result.imported++;
        } catch (e) {
          result.errors.push(`引擎.${name}: ${String(e)}`);
        }
      }
    }

    // 恢复设置
    const settings = data.settings as Record<string, unknown> || {};
    for (const [key, value] of Object.entries(settings)) {
      try { localStorage.setItem(key, String(value)); } catch {}
    }

    return result;
  }

  // ==========================================================
  // 辅助
  // ==========================================================

  private exportSettings(): Record<string, string> {
    const settings: Record<string, string> = {};
    const keys = ['lf-theme', 'lf-density', 'lf-font-size', 'lf-animations',
      'lf_daily_capacity', 'lf_water_goal', 'lf_reminders'];
    for (const key of keys) {
      const v = localStorage.getItem(key);
      if (v) settings[key] = v;
    }
    return settings;
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const dataExportService = new DataExportService();
