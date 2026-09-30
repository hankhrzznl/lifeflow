// ============================================================
// 数据导出/导入服务
// JSON 全量导出 + CSV 目标/打卡导出 + JSON 导入恢复
// ============================================================

import { db } from '@/lib/db';
import { getAllGoals } from '@/lib/db';
import { goalDB } from '@/services/goal-engine/schema';
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
    const dexieMap: Record<string, Dexie> = {
      LifeFlowDB: db,
      LifeFlowGoalEngine: goalDB,
    };

    const databases: Record<string, Record<string, unknown[]>> = {};
    for (const [dbName, dexie] of Object.entries(dexieMap)) {
      const tables: Record<string, unknown[]> = {};
      for (const table of dexie.tables) {
        tables[table.name] = await table.toArray();
      }
      databases[dbName] = tables;
    }

    // 旧格式兼容：将主库表也放在 mainDB/engineDB 下供旧版导入器读取
    const mainDB = databases.LifeFlowDB ?? {};

    const data = {
      exportDate: new Date().toISOString(),
      version: '3.0',
      databases,
      mainDB,       // 向后兼容旧导入器
      engineDB: databases.LifeFlowGoalEngine ?? {}, // 向后兼容旧导入器
      settings: this.exportSettings(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 导出目标列表为 CSV
   */
  async exportGoalsCSV(): Promise<string> {
    const goals = await getAllGoals();
    const typeLabel: Record<string, string> = { task: '任务', fitness: '运动', finance: '理财', sleep: '睡眠', water: '饮水' };
    const priorityLabel: Record<string, string> = { 'urgent-important': '高', 'not-urgent-important': '中', 'urgent-not-important': '低', 'not-urgent-not-important': '极低' };
    const headers = ['ID', '标题', '分类', '优先级', '进度', '状态', '截止日期', '创建时间'];
    const rows = goals.map((g) => [
      String(g.id ?? ''), g.name, typeLabel[g.type] ?? g.type,
      g.priority ? (priorityLabel[g.priority] ?? g.priority) : '',
      String(g.progress), g.status,
      g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : '',
      g.createdAt ? new Date(g.createdAt).toISOString().slice(0, 10) : '',
    ]);
    return [headers, ...rows].map((row) => row.map(this.escapeCSV).join(',')).join('\n');
  }

  /**
   * 导出打卡记录为 CSV
   */
  async exportCheckinsCSV(): Promise<string> {
    const atoms = await goalDB.dailyAtoms.toArray();
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
    try { data = JSON.parse(jsonString); } catch {
      throw new Error('无效的 JSON 文件');
    }
    if (!data.version) throw new Error('无效的备份文件：缺少版本信息');

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    const dexieMap: Record<string, Dexie> = {
      LifeFlowDB: db, LifeFlowGoalEngine: goalDB,
    };

    // 新格式：动态遍历 databases
    if (data.databases) {
      const databases = data.databases as Record<string, Record<string, unknown[]>>;
      for (const [dbName, tables] of Object.entries(databases)) {
        const dexie = dexieMap[dbName];
        if (!dexie) { result.errors.push(`未知数据库: ${dbName}, 已跳过`); continue; }
        for (const [tableName, records] of Object.entries(tables)) {
          if (!Array.isArray(records)) continue;
          // 确认表存在
          const tableExists = dexie.tables.some((t) => t.name === tableName);
          if (!tableExists) { result.errors.push(`${dbName}.${tableName}: 表不存在, 已跳过`); continue; }
          const table = dexie.table(tableName);
          for (const record of records) {
            try { await table.put(record); result.imported++; } catch (e) {
              result.errors.push(`${dbName}.${tableName}: ${String(e)}`);
            }
          }
        }
      }
    } else {
      // 向后兼容旧格式 (v2.2)
      const mainDB = (data.mainDB as Record<string, unknown[]>) || {};
      const mainTables = [
        'goals','plans','tasks','finRecords','finAccounts',
        'sleepRecords','dailyWaterRecords','muscleRecords',
      ];
      for (const name of mainTables) {
        const records = mainDB[name];
        if (!Array.isArray(records)) continue;
        for (const record of records) {
          try { await ((db as unknown) as Record<string, Dexie.Table>)[name]?.put(record); result.imported++; } catch (e) {
            result.errors.push(`主库.${name}: ${String(e)}`);
          }
        }
      }

      const engineData = (data.engineDB as Record<string, unknown[]>) || {};
      const engineTables = ['goals','milestones','weeklyTasks','dailyAtoms','progressSnapshots'];
      for (const name of engineTables) {
        const records = engineData[name];
        if (!Array.isArray(records)) continue;
        for (const record of records) {
          try { await ((goalDB as unknown) as Record<string, Dexie.Table>)[name]?.put(record); result.imported++; } catch (e) {
            result.errors.push(`引擎.${name}: ${String(e)}`);
          }
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
