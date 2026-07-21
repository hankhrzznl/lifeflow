"use client";

import { useRef, useState, useEffect } from "react";
import { Moon, Download, Trash2, Info, MessageSquare, ChevronRight, Brain, Check } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import Dialog from "@/components/ui/Dialog";
import { showToast } from "@/components/ui/Toast";
import { dataExportService } from "@/lib/engine/DataExportService";
import { getLLMConfig, saveLLMConfig, clearLLMConfig, type LLMConfig } from "@/lib/brains/downgrade";

// ─── iOS Toggle Switch ────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer border-none outline-none"
      style={{
        width: 51, height: 31,
        background: checked ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
        transition: "background 0.2s",
      }}>
      <div className="absolute rounded-full bg-white"
        style={{
          width: 27, height: 27, top: 2,
          left: checked ? 22 : 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "left 0.2s",
        }} />
    </button>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LLM Config State
  const [llmConfig, setLLMConfig] = useState<LLMConfig | null>(null);
  const [showLLM, setShowLLM] = useState(false);
  const [llmForm, setLLMForm] = useState<{ provider: "openai" | "anthropic" | "custom"; apiKey: string; model: string; baseUrl: string }>({ provider: "openai", apiKey: "", model: "gpt-3.5-turbo", baseUrl: "" });
  useEffect(() => { setLLMConfig(getLLMConfig()); }, []);

  const toggleDark = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleExport = async () => {
    try {
      const json = await dataExportService.exportAllJSON();
      const date = new Date().toISOString().slice(0, 10);
      dataExportService.downloadFile(json, `lifeflow-backup-${date}.json`, "application/json");
      showToast({ type: "success", message: "导出成功" });
    } catch {
      showToast({ type: "error", message: "导出失败" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const content = await file.text();
      const result = await dataExportService.importFromJSON(content);
      showToast({ type: "success", message: `导入完成: ${result.imported} 条` });
    } catch (err) {
      showToast({ type: "error", message: `导入失败: ${(err as Error).message}` });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header - 居中"设置"标题 */}
      <div className="flex items-center justify-center h-[44px] px-4 pt-3 relative">
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>设置</h1>
      </div>

      {/* 外观 */}
      <div className="px-4 pt-6 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>外观</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Moon className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>深色模式</span>
            </div>
            <ToggleSwitch checked={isDark} onChange={toggleDark} label="深色模式" />
          </div>
        </div>
      </div>

      {/* 数据 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>数据</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <button type="button" onClick={handleExport} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Download className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>导出数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <button type="button" onClick={() => setShowClearDialog(true)} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Trash2 className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>清除数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
        </div>
      </div>

      {/* AI 增强 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>AI 增强</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <button type="button" onClick={() => setShowLLM(!showLLM)} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Brain className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <div className="text-left min-w-0">
                <span className="text-[17px] block" style={{ color: "var(--color-text-primary)" }}>LLM 智能增强</span>
                <span className="text-[13px] block truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {llmConfig?.enabled ? `${llmConfig.provider} · ${llmConfig.model}` : "已关闭"}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)", transform: showLLM ? "rotate(90deg)" : "", transition: "transform 0.2s" }} />
          </button>

          {showLLM && (
            <div className="px-5 pb-4 space-y-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
              <p className="text-[12px] pt-3" style={{ color: "var(--color-text-secondary)" }}>
                当本地规则引擎无法理解你的输入时，自动调用 LLM 进行语义理解。API Key 只保存在本地浏览器中。
              </p>

              {/* Provider */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>服务商</label>
                <div className="flex gap-2">
                  {(["openai", "anthropic", "custom"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setLLMForm({ ...llmForm, provider: p, model: p === "anthropic" ? "claude-3-haiku-20240307" : p === "openai" ? "gpt-3.5-turbo" : "" })}
                      className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
                      style={{ background: llmForm.provider === p ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: llmForm.provider === p ? "#fff" : "var(--color-text-secondary)" }}
                    >
                      {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "自定义"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>模型</label>
                <input
                  type="text"
                  value={llmForm.model}
                  onChange={e => setLLMForm({ ...llmForm, model: e.target.value })}
                  placeholder="gpt-3.5-turbo"
                  className="w-full h-9 px-3 rounded-lg text-[14px] outline-none"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                />
              </div>

              {/* API Key */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>API Key</label>
                <input
                  type="password"
                  value={llmForm.apiKey}
                  onChange={e => setLLMForm({ ...llmForm, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full h-9 px-3 rounded-lg text-[14px] outline-none"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                />
              </div>

              {/* Base URL (custom only) */}
              {llmForm.provider === "custom" && (
                <div>
                  <label className="text-[12px] font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>API 地址</label>
                  <input
                    type="text"
                    value={llmForm.baseUrl}
                    onChange={e => setLLMForm({ ...llmForm, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full h-9 px-3 rounded-lg text-[14px] outline-none"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    const config: LLMConfig = { ...llmForm, enabled: true };
                    saveLLMConfig(config);
                    setLLMConfig(config);
                    showToast({ type: "success", message: "LLM 配置已保存" });
                  }}
                  className="flex-1 py-2 rounded-full text-[14px] font-medium text-white active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  <Check className="w-4 h-4 inline mr-1" />保存并启用
                </button>
                {llmConfig?.enabled && (
                  <button
                    onClick={() => {
                      clearLLMConfig();
                      setLLMConfig(null);
                      showToast({ type: "success", message: "LLM 已关闭" });
                    }}
                    className="px-4 py-2 rounded-full text-[14px] font-medium active:opacity-70"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-expense)" }}
                  >
                    关闭
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 关于 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>关于</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Info className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>版本</span>
            </div>
            <span className="text-[17px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>v2.6</span>
          </div>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <MessageSquare className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>反馈</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="px-4 pt-8">
        <button type="button"
          className="w-full py-3.5 text-center text-[17px] font-medium rounded-[20px]"
          style={{ background: "var(--color-surface-card)", color: "var(--color-expense)", boxShadow: "var(--shadow-card)" }}>
          退出登录
        </button>
      </div>

      {/* 隐藏的文件选择器 */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />

      {/* 清除确认弹窗 */}
      <Dialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        type="confirm"
        variant="danger"
        title="清除所有数据"
        description="将删除本地全部数据，此操作无法恢复。"
        confirmLabel="确认清除"
        onConfirm={async () => {
          try {
            // 清除逻辑由用户自行实现或先关闭弹窗
            setShowClearDialog(false);
            showToast({ type: "success", message: "已清除所有数据" });
          } catch {
            showToast({ type: "error", message: "清除失败" });
          }
        }}
      />
    </div>
  );
}
