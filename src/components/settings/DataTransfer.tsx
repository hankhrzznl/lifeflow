"use client";

import { useState } from "react";
import { dataExportService, type ImportResult } from "@/lib/engine/DataExportService";

export function DataImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    try {
      const content = await file.text();
      const r = await dataExportService.importFromJSON(content);
      setResult(r);
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [(err as Error).message] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-base" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        数据导入
      </h4>
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <input
          type="file" accept=".json" onChange={handleFileSelect}
          className="hidden" id="import-file" disabled={importing}
        />
        <label htmlFor="import-file" className="cursor-pointer block">
          <span className="text-3xl">📁</span>
          <p className="text-sm mt-2" style={{ color: "var(--text-primary)" }}>
            {importing ? "导入中..." : "点击选择 JSON 备份文件"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            支持 LifeFlow v2.0+ 的备份文件
          </p>
        </label>
      </div>

      {result && (
        <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "var(--surface-desk-light)" }}>
          <p style={{ color: "var(--text-primary)" }}>导入: {result.imported} 条</p>
          <p style={{ color: "var(--text-secondary)" }}>跳过: {result.skipped} 条</p>
          {result.errors.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer" style={{ color: "var(--warning)" }}>
                {result.errors.length} 个错误
              </summary>
              <ul className="text-xs mt-1 max-h-20 overflow-auto space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function DataExport() {
  const [exporting, setExporting] = useState(false);

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const json = await dataExportService.exportAllJSON();
      const date = new Date().toISOString().slice(0, 10);
      dataExportService.downloadFile(json, `lifeflow-backup-${date}.json`, 'application/json');
    } catch (err) {
      console.error('[DataExport] 导出失败:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const csv = await dataExportService.exportCheckinsCSV();
      const date = new Date().toISOString().slice(0, 10);
      dataExportService.downloadFile(csv, `lifeflow-checkins-${date}.csv`, 'text/csv');
    } catch (err) {
      console.error('[DataExport] CSV导出失败:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-base" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        数据导出
      </h4>
      <div className="flex gap-2">
        <button
          onClick={handleExportJSON}
          disabled={exporting}
          className="flex-1 py-2.5 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)" }}
        >
          {exporting ? "导出中..." : "导出 JSON"}
        </button>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="flex-1 py-2.5 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: "var(--surface-fabric)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          导出 CSV
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        JSON 包含本地全部数据（三个数据库的所有表及设置项），CSV 仅包含打卡记录
      </p>
    </div>
  );
}
