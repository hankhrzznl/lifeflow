"use client";

import { useState } from "react";
import type { DowngradeSuggestion } from "@/lib/engine/DowngradeEngine";
import MascotIllustration from "@/components/ui/MascotIllustration";
import { AlertTriangle, Check, X } from "lucide-react";

export function DowngradeCard({
  suggestion, onConfirm, onDismiss,
}: {
  suggestion: DowngradeSuggestion;
  onConfirm: (pauseGoalIds: string[]) => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!suggestion.shouldDowngrade) return null;

  return (
    <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "var(--warning-light)", border: "1px solid var(--warning-light)" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex-shrink-0">
          <MascotIllustration state="confused" size={40} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning)" }} />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>小织注意到你最近有些累</h4>
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{suggestion.reason}</p>

          {expanded && (
            <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "var(--surface-fabric)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-primary)" }}>{suggestion.suggestedAction}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>被暂停的目标可以随时在设置中恢复，数据不会丢失。</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setExpanded(!expanded)} className="text-xs hover:underline"
              style={{ color: "var(--warning)" }}>{expanded ? "收起" : "查看详情"}</button>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => onConfirm(suggestion.pauseGoals)}
              className="flex-1 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              style={{ backgroundColor: "var(--warning)", color: "var(--text-inverse)" }}>
              <Check className="w-3 h-3" /> 帮我减负
            </button>
            <button onClick={onDismiss}
              className="flex-1 py-2 border rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <X className="w-3 h-3" /> 暂时不用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
