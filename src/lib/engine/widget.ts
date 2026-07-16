// ============================================================
// 桌面小组件类型定义
// ============================================================

export enum WidgetType {
  TODAY_TASKS = 'today_tasks',
  GOAL_PROGRESS = 'goal_progress',
  HABIT_CHECKIN = 'habit_checkin',
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large';
  refreshInterval: number;
  goalId?: string;
}

export interface WidgetData {
  config: WidgetConfig;
  lastUpdated: Date;
  items: WidgetItem[];
}

export interface WidgetItem {
  id: string;
  title: string;
  subtitle?: string;
  progress?: number;
  completed?: boolean;
  icon?: string;
  color?: string;
}
