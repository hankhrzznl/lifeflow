"use client";

import { motion } from "framer-motion";

interface HeatmapData {
  date: string;
  count: number;
  maxCount: number;
}

export function HeatmapGrid({ data, months = 3 }: { data: HeatmapData[]; months?: number }) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
  const weeks: (HeatmapData | null)[][] = [];
  
  let currentDate = new Date(startDate);
  // Back to Sunday
  currentDate.setDate(currentDate.getDate() - currentDate.getDay());
  
  let currentWeek: (HeatmapData | null)[] = [];
  
  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    const found = data.find(d => d.date === dateStr);
    currentWeek.push(found || null);
    
    if (currentDate.getDay() === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const getColor = (item: HeatmapData | null): string => {
    if (!item || item.count === 0) return "bg-gray-100 dark:bg-gray-800";
    const intensity = item.count / Math.max(1, item.maxCount);
    if (intensity <= 0.25) return "bg-emerald-200 dark:bg-emerald-900";
    if (intensity <= 0.5) return "bg-emerald-400 dark:bg-emerald-700";
    if (intensity <= 0.75) return "bg-emerald-500 dark:bg-emerald-600";
    return "bg-emerald-600 dark:bg-emerald-500";
  };

  const dayLabels = ["", "一", "", "三", "", "五", ""];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((l, i) => (
            <div key={i} className="w-5 h-3 flex items-center text-[9px] text-gray-400">{l}</div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((item, di) => (
              <motion.div
                key={di}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (wi * 7 + di) * 0.002 }}
                className={`w-3 h-3 rounded-sm ${getColor(item)}`}
                title={item ? `${item.date}: ${item.count}` : "无数据"}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-gray-400">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
        <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
        <span>多</span>
      </div>
    </div>
  );
}
