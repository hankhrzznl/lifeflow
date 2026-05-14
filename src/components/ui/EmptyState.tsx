import { LucideIcon } from "lucide-react";
import { isValidElement } from "react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon | ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function isComponentIcon(icon: LucideIcon | ReactNode): icon is LucideIcon {
  return !isValidElement(icon);
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const Icon = isComponentIcon(icon) ? icon : null;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        {Icon && <Icon className="w-8 h-8 text-gray-400" />}
        {!Icon && (icon as ReactNode)}
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
