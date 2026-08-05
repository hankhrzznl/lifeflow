"use client";

import { useEffect, useState, useCallback } from "react";
import Dialog from "@/components/ui/Dialog";
import { showToast } from "@/components/ui/Toast";
import {
  getV1GoalMigrationStatus,
  runV1GoalMigration,
  rollbackV1GoalMigration,
  exportV1GoalBackup,
  type V1GoalMigrationStatus,
} from "@/lib/migrations/v1-goal-migration";
import { Download, ArrowRightLeft, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ConfirmAction = "migrate" | "rollback" | null;

export default function V1GoalMigrationDialog({ open, onClose }: Props) {
  const [status, setStatus] = useState<V1GoalMigrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmAction>(null);

  const refresh = useCallback(async () => {
    setStatus(await getV1GoalMigrationStatus());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleMigrate = async () => {
    setBusy(true);
    try {
      const r = await runV1GoalMigration();
      await refresh();
      showToast({ type: "success", message: `迁移完成：新增 ${r.migrated} 个，跳过 ${r.skipped} 个` });
    } catch (err) {
      showToast({ type: "error", message: `迁移失败：${err instanceof Error ? err.message : "请重试"}` });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const handleRollback = async () => {
    setBusy(true);
    try {
      const r = await rollbackV1GoalMigration();
      await refresh();
      showToast({ type: "success", message: `已回滚 ${r.rolledBack} 个目标` });
    } catch (err) {
      showToast({ type: "error", message: `回滚失败：${err instanceof Error ? err.message : "请重试"}` });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const handleExportBackup = () => {
    const ok = exportV1GoalBackup();
    showToast({ type: ok ? "success" : "info", message: ok ? "备份已下载" : "暂无备份可下载" });
  };

  const canMigrate = !!status && status.pendingCount > 0;
  const canRollback = !!status && status.migratedCount > 0;

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--lifeflow-border)",
  };

  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    height: 44,
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      type="info"
      title="v1 目标数据迁移"
      description={
        confirming
          ? undefined
          : "将旧版目标系统（efficiency v1）复制到新版五层拆解目标（GoalV2）。迁移不修改 v1 数据，可一键回滚。"
      }
    >
      {confirming ? (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {confirming === "migrate"
              ? `将复制 ${status?.pendingCount ?? 0} 个 v1 目标到 GoalV2（含习惯打卡记录迁移为日行动）。v1 原数据保留，随时可回滚。`
              : `将删除本次迁移创建的 ${status?.migratedCount ?? 0} 个 v2 目标及其策略、周任务、日行动。v1 原数据不受影响。`}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={busy}
              style={{
                ...btnBase,
                flex: 1,
                background: "var(--lifeflow-muted)",
                color: "var(--color-text-primary)",
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirming === "migrate" ? handleMigrate : handleRollback}
              disabled={busy}
              style={{
                ...btnBase,
                flex: 1,
                background: confirming === "rollback" ? "var(--color-expense, #EF4444)" : "var(--lifeflow-primary)",
                color: "#fff",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "处理中…" : confirming === "migrate" ? "开始迁移" : "确认回滚"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1">
          {status ? (
            <div>
              <div style={rowStyle}>
                <span className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>v1 目标总数</span>
                <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{status.v1Count}</span>
              </div>
              <div style={rowStyle}>
                <span className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>已迁移 / 待迁移</span>
                <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{status.migratedCount} / {status.pendingCount}</span>
              </div>
              <div style={rowStyle}>
                <span className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>GoalV2 现有目标</span>
                <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{status.v2Count}</span>
              </div>
              <div style={rowStyle}>
                <span className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>v1 备份</span>
                <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {status.hasBackup ? `${(status.backupBytes / 1024).toFixed(1)} KB` : "未生成"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>加载中…</div>
          )}

          <div className="flex flex-col gap-3 mt-4">
            <button
              type="button"
              onClick={() => setConfirming("migrate")}
              disabled={!canMigrate || busy}
              style={{
                ...btnBase,
                background: "var(--lifeflow-primary)",
                color: "#fff",
                opacity: !canMigrate || busy ? 0.45 : 1,
              }}
            >
              <ArrowRightLeft className="w-4 h-4" />
              执行迁移（{status?.pendingCount ?? 0}）
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={!status?.hasBackup}
              style={{
                ...btnBase,
                background: "var(--lifeflow-muted)",
                color: "var(--color-text-primary)",
                opacity: status?.hasBackup ? 1 : 0.45,
              }}
            >
              <Download className="w-4 h-4" />
              下载 v1 备份
            </button>
            <button
              type="button"
              onClick={() => setConfirming("rollback")}
              disabled={!canRollback || busy}
              style={{
                ...btnBase,
                background: "var(--lifeflow-muted)",
                color: "var(--color-expense, #EF4444)",
                opacity: !canRollback || busy ? 0.45 : 1,
              }}
            >
              <RotateCcw className="w-4 h-4" />
              回滚（{status?.migratedCount ?? 0}）
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
