import { Flame, Clock, Zap, Calendar, TrendingUp, DollarSign, ListTodo, BarChart3 } from "lucide-react";

export interface PluginConfig {
  icon: typeof Flame;
  label: string;
  path: string;
}

export const PLUGINS_CONFIG: Record<string, PluginConfig> = {
  habit: {
    icon: Flame,
    label: "习惯",
    path: "/plugins/habit",
  },
  "focus-timer": {
    icon: Zap,
    label: "专注",
    path: "/plugins/focus-timer",
  },
  timeline: {
    icon: TrendingUp,
    label: "时间轴",
    path: "/plugins/timeline",
  },
  finance: {
    icon: DollarSign,
    label: "财务",
    path: "/plugins/finance",
  },
  "task-inbox": {
    icon: ListTodo,
    label: "任务清单",
    path: "/plugins/task-inbox",
  },
};

export function getPluginConfig(name: string): PluginConfig | undefined {
  return PLUGINS_CONFIG[name];
}
