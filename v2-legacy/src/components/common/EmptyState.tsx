"use client";

import React from "react";
import { Inbox } from "lucide-react";

// ============================================================
// 类型
// ============================================================

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

// ============================================================
// 组件
// ============================================================

function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {/* 图标 */}
      <div className="mb-5">
        {icon ?? <Inbox className="w-12 h-12 text-gray-300" strokeWidth={1.5} />}
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-gray-900 mb-1.5">{title}</h3>

      {/* 描述 */}
      {description && (
        <p className="text-sm text-gray-500 max-w-xs mb-6 leading-relaxed">{description}</p>
      )}

      {/* 操作按钮 */}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-full px-6 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors active:scale-[0.97]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================
// 导出
// ============================================================

export default EmptyState;
export { EmptyState };
