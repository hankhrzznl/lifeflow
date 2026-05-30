"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Battery, Brain, Dumbbell, Flame, Heart, 
  Home, BookOpen, TrendingUp, Trophy, Zap, Clock,
  Plus, ChevronRight, Calendar, Target, Coffee, Moon,
  Wine, Monitor, Plane, Briefcase, Play, Pause, Settings,
  Bike, Timer, Download,
  AlertTriangle, CheckCircle, TrendingDown, ChevronLeft, Star, ArrowLeft
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  getDailyHealthSummary, calculateHealthScore, 
  getRecentWorkouts, getRecentJournalEntries,
  addWorkoutRecord, addJournalEntry,
  getRecentDailyMetrics, addOrUpdateDailyMetrics
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import { WORKOUT_TYPES, JOURNAL_TAGS, TRAINING_CATEGORIES, TRAINING_MODES, DailyHealthRecord } from "@/lib/types";
import MusclePage from "./components/MusclePage";
import {
  getDailyHealthRecordByDate,
  getRecentDailyHealthRecords,
  addDailyHealthRecord,
  updateDailyHealthRecord,
  getMetricHistory
} from "@/lib/db";

// 日历组件
function CalendarWidget({
  currentMonth,
  onMonthChange,
  datesWithRecords,
  selectedDate,
  onSelectDate
}: {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  datesWithRecords: Set<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const goToPrevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <h3 className="text-white font-semibold">{year}年{monthNames[month]}</h3>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className="aspect-square" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasRecord = datesWithRecords.has(dateStr);

          return (
            <button
              key={index}
              onClick={() => onSelectDate(dateStr)}
              className={`
                aspect-square rounded-lg flex items-center justify-center text-sm transition-all
                ${isToday ? 'bg-indigo-500 text-white font-medium' : ''}
                ${isSelected && !isToday ? 'bg-gray-700 text-white ring-2 ring-indigo-500' : ''}
                ${!isToday && !isSelected ? 'text-gray-300 hover:bg-gray-700' : ''}
              `}
            >
              {day}
              {hasRecord && !isToday && (
                <div className="absolute bottom-1 w-1 h-1 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 健康指标卡片组件
function HealthMetricCard({
  icon,
  label,
  value,
  unit,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        bg-gray-800/50 rounded-xl p-4 border border-gray-700/50
        ${onClick ? 'cursor-pointer hover:bg-gray-800 hover:border-gray-600/50 transition-all' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-700/50 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-white text-lg font-semibold mt-1">
              {value !== undefined && value !== null && value !== '' ? value : '-'}
              {value !== undefined && value !== null && value !== '' && (
                <span className="text-gray-400 text-sm ml-1">{unit}</span>
              )}
            </p>
          </div>
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-gray-500" />}
      </div>
    </motion.div>
  );
}

type TabType = "today" | "trends" | "journal" | "workout" | "training" | "muscle";

interface MetricRingProps {
  value: number;
  max: number;
  color: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

function MetricRing({ value, max, color, label, size = "md" }: MetricRingProps) {
  const radius = size === "sm" ? 30 : size === "lg" ? 55 : 40;
  const strokeWidth = size === "sm" ? 4 : size === "lg" ? 8 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((value / max) * 100, 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative">
      <svg className={`w-${size === "sm" ? 16 : size === "lg" ? 32 : 24} h-${size === "sm" ? 16 : size === "lg" ? 32 : 24} transform -rotate-90`}>
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke="#1F2937"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold text-white ${size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg"}`}>
          {Math.round(progress)}%
        </span>
        {size === "lg" && <span className="text-xs text-gray-400">{label}</span>}
      </div>
    </div>
  );
}

function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div 
      className={`bg-gray-800/50 backdrop-blur-lg rounded-2xl p-4 border border-gray-700/50 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function EnergyChart() {
  const [hourlyData, setHourlyData] = useState<number[]>([]);
  
  useEffect(() => {
    const data = Array.from({ length: 24 }, (_, i) => {
      const baseEnergy = 50;
      const variation = Math.sin((i - 6) * Math.PI / 12) * 20;
      const randomNoise = (Math.random() - 0.5) * 10;
      return Math.max(10, Math.min(100, baseEnergy + variation + randomNoise));
    });
    setHourlyData(data);
  }, []);

  const currentHour = new Date().getHours();
  const maxValue = hourlyData.length > 0 ? Math.max(...hourlyData) : 0;
  const minValue = hourlyData.length > 0 ? Math.min(...hourlyData) : 0;
  const avgValue = hourlyData.length > 0 ? Math.round(hourlyData.reduce((a, b) => a + b, 0) / hourlyData.length) : 0;

  const points = hourlyData.length > 0 
    ? hourlyData.map((value, i) => {
        const x = (i / 23) * 100;
        const y = 100 - (value || 50);
        return `${x},${y}`;
      }).join(' ')
    : '0,50 100,50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-700/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">24小时趋势</span>
          </div>
          <div className="flex gap-4 text-xs">
            <div className="text-gray-400">
              <span className="text-white font-medium">{maxValue}%</span> 最高
            </div>
            <div className="text-gray-400">
              <span className="text-white font-medium">{minValue}%</span> 最低
            </div>
            <div className="text-gray-400">
              <span className="text-white font-medium">{avgValue}%</span> 平均
            </div>
          </div>
        </div>
        
        <div className="h-32 relative">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="energyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,100 ${points} 100,100`}
              fill="url(#energyGradient)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#10B981"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={(currentHour / 23) * 100}
              cy={hourlyData.length > 0 ? 100 - (hourlyData[currentHour] || 50) : 50}
              r="2"
              fill="#10B981"
              stroke="#fff"
              strokeWidth="0.5"
            />
          </svg>
          
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 mt-2">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>现在</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// 指标详情模态框
function MetricDetailModal({
  metric,
  metricLabel,
  isOpen,
  onClose
}: {
  metric: 'weight' | 'sleepDuration' | 'sleepScore' | 'restingHeartRate' | 
          'bloodPressureSystolic' | 'bloodPressureDiastolic' | 'stressLevel' | 
          'trainingDuration' | 'caloriesBurned';
  metricLabel: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<'trend' | 'compare'>('trend');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [chartData, setChartData] = useState<Array<{ date: string; value: number }>>([]);
  const [compareDateA, setCompareDateA] = useState<string>('');
  const [compareDateB, setCompareDateB] = useState<string>('');
  const [compareRecordA, setCompareRecordA] = useState<DailyHealthRecord | null>(null);
  const [compareRecordB, setCompareRecordB] = useState<DailyHealthRecord | null>(null);
  const [allRecords, setAllRecords] = useState<DailyHealthRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 获取所有记录
      const records = await getRecentDailyHealthRecords(365);
      setAllRecords(records);

      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      if (dateRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === 'month') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setDate(startDate.getDate() - 90);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // 获取趋势数据
      const historyData = await getMetricHistory(metric, startStr, endStr);
      setChartData(historyData.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Failed to load metric data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareDateAChange = async (date: string) => {
    setCompareDateA(date);
    const record = await getDailyHealthRecordByDate(date);
    setCompareRecordA(record || null);
  };

  const handleCompareDateBChange = async (date: string) => {
    setCompareDateB(date);
    const record = await getDailyHealthRecordByDate(date);
    setCompareRecordB(record || null);
  };

  const getMetricValue = (record: DailyHealthRecord | null): string => {
    if (!record) return '-';
    const value = record[metric];
    if (value === undefined || value === null) return '-';
    return value.toString();
  };

  const getComparison = () => {
    if (!compareRecordA || !compareRecordB) return null;
    const valA = compareRecordA[metric];
    const valB = compareRecordB[metric];
    if (valA === undefined || valA === null || valB === undefined || valB === null) return null;
    const diff = valB - valA;
    const percent = valA !== 0 ? ((diff / valA) * 100).toFixed(1) : '0';
    return { diff, percent, isPositive: diff > 0 };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl border border-gray-700"
      >
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-white">{metricLabel}详情</h3>
            <p className="text-sm text-gray-400 mt-1">趋势分析与历史对比</p>
          </div>
        </div>

        {/* Tab切换 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('trend')}
            className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
              viewMode === 'trend'
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            📈 趋势图表
          </button>
          <button
            onClick={() => setViewMode('compare')}
            className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
              viewMode === 'compare'
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            📊 历史对比
          </button>
        </div>

        {/* 趋势图表视图 */}
        {viewMode === 'trend' && (
          <div className="space-y-4">
            {/* 时间范围选择 */}
            <div className="flex gap-2">
              {[
                { key: 'week', label: '近7天' },
                { key: 'month', label: '近30天' },
                { key: 'quarter', label: '近90天' },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setDateRange(option.key as any)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateRange === option.key
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* 趋势图表 */}
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      labelFormatter={(value) => formatDate(value)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#6366F1" 
                      strokeWidth={2}
                      dot={{ fill: '#6366F1', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-gray-800/50 rounded-2xl border border-gray-700">
                <p className="text-gray-400">暂无数据，请先添加记录</p>
              </div>
            )}

            {/* 统计信息 */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 text-center">
                  <p className="text-xs text-gray-400 mb-1">平均值</p>
                  <p className="text-lg font-bold text-white">
                    {(chartData.reduce((sum, item) => sum + item.value, 0) / chartData.length).toFixed(1)}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 text-center">
                  <p className="text-xs text-gray-400 mb-1">最大值</p>
                  <p className="text-lg font-bold text-green-400">
                    {Math.max(...chartData.map(item => item.value))}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 text-center">
                  <p className="text-xs text-gray-400 mb-1">最小值</p>
                  <p className="text-lg font-bold text-red-400">
                    {Math.min(...chartData.map(item => item.value))}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 历史对比视图 */}
        {viewMode === 'compare' && (
          <div className="space-y-4">
            {/* 日期选择 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">日期 A</label>
                <input
                  type="date"
                  value={compareDateA}
                  onChange={(e) => handleCompareDateAChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">日期 B</label>
                <input
                  type="date"
                  value={compareDateB}
                  onChange={(e) => handleCompareDateBChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 对比结果 */}
            {compareDateA && compareDateB && (
              <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">{formatDate(compareDateA)}</p>
                    <p className="text-3xl font-bold text-white">{getMetricValue(compareRecordA)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">{formatDate(compareDateB)}</p>
                    <p className="text-3xl font-bold text-white">{getMetricValue(compareRecordB)}</p>
                  </div>
                </div>

                {compareRecordA && compareRecordB && getComparison() && (
                  <div className={`text-center py-3 rounded-xl ${
                    getComparison()!.isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    <p className={`text-lg font-bold ${
                      getComparison()!.isPositive ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {getComparison()!.isPositive ? '↑' : '↓'} {Math.abs(getComparison()!.diff)}
                    </p>
                    <p className={`text-sm ${
                      getComparison()!.isPositive ? 'text-green-400/70' : 'text-red-400/70'
                    }`}>
                      ({getComparison()!.isPositive ? '+' : ''}{getComparison()!.percent}%)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 快速选择最近记录 */}
            <div>
              <p className="text-sm text-gray-400 mb-2">快速选择</p>
              <div className="grid grid-cols-3 gap-2">
                {allRecords.slice(0, 6).map((record) => (
                  <button
                    key={record.id}
                    onClick={() => {
                      if (!compareDateA || (compareDateA && compareDateB)) {
                        setCompareDateA(record.date);
                        handleCompareDateAChange(record.date);
                        setCompareDateB('');
                        setCompareRecordB(null);
                      } else {
                        setCompareDateB(record.date);
                        handleCompareDateBChange(record.date);
                      }
                    }}
                    className="py-2 px-3 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {formatDate(record.date)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function TodayPage() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedRecord, setSelectedRecord] = useState<DailyHealthRecord | null>(null);
  const [datesWithRecords, setDatesWithRecords] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<{
    metric: 'weight' | 'sleepDuration' | 'sleepScore' | 'restingHeartRate' | 
            'bloodPressureSystolic' | 'bloodPressureDiastolic' | 'stressLevel' | 
            'trainingDuration' | 'caloriesBurned';
    label: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const records = await getRecentDailyHealthRecords(365);
      const dates = new Set(records.map(r => r.date));
      setDatesWithRecords(dates);

      const record = await getDailyHealthRecordByDate(selectedDate);
      setSelectedRecord(record || null);
    } catch (error) {
      console.error('Failed to load health records:', error);
      showToast({ message: '加载健康记录失败', type: 'error', duration: 2000 });
    }
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    try {
      const record = await getDailyHealthRecordByDate(date);
      setSelectedRecord(record || null);
    } catch (error) {
      console.error('Failed to load record:', error);
    }
  };

  const handleSaveRecord = async (record: Partial<DailyHealthRecord>) => {
    setIsLoading(true);
    try {
      const existing = await getDailyHealthRecordByDate(selectedDate);
      if (existing) {
        await updateDailyHealthRecord(existing.id!, record);
        showToast({ message: '记录已更新', type: 'success', duration: 2000 });
      } else {
        await addDailyHealthRecord({
          ...record,
          date: selectedDate,
          timestamp: Date.now(),
        } as any);
        showToast({ message: '记录已保存', type: 'success', duration: 2000 });
      }
      await loadData();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to save record:', error);
      showToast({ message: '保存失败', type: 'error', duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  const getMetricIcon = (label: string) => {
    switch (label) {
      case '体重': return <Battery className="w-5 h-5 text-green-400" />;
      case '睡眠时长': return <Moon className="w-5 h-5 text-blue-400" />;
      case '入睡时间': return <Clock className="w-5 h-5 text-purple-400" />;
      case '睡眠评分': return <Star className="w-5 h-5 text-yellow-400" />;
      case '心率': return <Heart className="w-5 h-5 text-red-400" />;
      case '血压': return <Activity className="w-5 h-5 text-pink-400" />;
      case '压力': return <Brain className="w-5 h-5 text-purple-400" />;
      case '训练时长': return <Dumbbell className="w-5 h-5 text-indigo-400" />;
      case '卡路里': return <Flame className="w-5 h-5 text-orange-400" />;
      case '训练感受': return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const metrics = [
    { label: '体重', value: selectedRecord?.weight, unit: 'kg', metric: 'weight' as const },
    { label: '睡眠时长', value: selectedRecord?.sleepDuration, unit: '小时', metric: 'sleepDuration' as const },
    { label: '入睡时间', value: selectedRecord?.sleepTime || '-', unit: '', metric: null },
    { label: '睡眠评分', value: selectedRecord?.sleepScore !== undefined ? selectedRecord.sleepScore : '-', unit: '分', metric: 'sleepScore' as const },
    { label: '心率', value: selectedRecord?.restingHeartRate !== undefined ? selectedRecord.restingHeartRate : '-', unit: 'bpm', metric: 'restingHeartRate' as const },
    { label: '血压', value: selectedRecord?.bloodPressureSystolic && selectedRecord?.bloodPressureDiastolic 
      ? `${selectedRecord.bloodPressureSystolic}/${selectedRecord.bloodPressureDiastolic}` 
      : '-', unit: 'mmHg', metric: null },
    { label: '压力', value: selectedRecord?.stressLevel !== undefined ? selectedRecord.stressLevel : '-', unit: '', metric: 'stressLevel' as const },
    { label: '训练时长', value: selectedRecord?.trainingDuration !== undefined ? selectedRecord.trainingDuration : 0, unit: '分钟', metric: 'trainingDuration' as const },
    { label: '卡路里', value: selectedRecord?.caloriesBurned !== undefined ? selectedRecord.caloriesBurned : 0, unit: 'kcal', metric: 'caloriesBurned' as const },
    { label: '训练感受', value: selectedRecord?.trainingFeeling === 'easy' ? '轻松' 
      : selectedRecord?.trainingFeeling === 'medium' ? '适中' 
      : selectedRecord?.trainingFeeling === 'hard' ? '吃力' 
      : selectedRecord?.trainingDuration === 0 ? '休息日' : '-', unit: '', metric: null },
  ];

  return (
    <div className="space-y-4">
      {/* 日历 */}
      <CalendarWidget
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        datesWithRecords={datesWithRecords}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* 日期标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {formatDate(selectedDate)}健康记录
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {selectedRecord ? '点击指标查看详情' : '暂无记录，点击添加'}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {selectedRecord ? '编辑' : '添加记录'}
        </motion.button>
      </div>

      {/* 指标卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            onClick={() => metric.metric && setSelectedMetric({ metric: metric.metric, label: metric.label })}
            className={metric.metric ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'cursor-default'}
          >
            <HealthMetricCard
              icon={getMetricIcon(metric.label)}
              label={metric.label}
              value={metric.value ?? '-'}
              unit={metric.unit}
            />
          </div>
        ))}
      </div>

      {/* 提示信息 */}
      {selectedRecord && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-300 text-sm">
            💡 点击指标卡片查看趋势图表和历史对比
          </p>
        </div>
      )}

      {/* 指标详情模态框 */}
      {selectedMetric && (
        <MetricDetailModal
          metric={selectedMetric.metric}
          metricLabel={selectedMetric.label}
          isOpen={!!selectedMetric}
          onClose={() => setSelectedMetric(null)}
        />
      )}

      {/* 健康记录添加/编辑模态框 */}
      <AnimatePresence>
        {showAddModal && (
          <AddHealthRecordModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            selectedDate={selectedDate}
            existingRecord={selectedRecord}
            onSave={handleSaveRecord}
            isLoading={isLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// 健康记录添加/编辑模态框
function AddHealthRecordModal({
  isOpen,
  onClose,
  selectedDate,
  existingRecord,
  onSave,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  existingRecord: DailyHealthRecord | null;
  onSave: (record: Partial<DailyHealthRecord>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    weight: existingRecord?.weight?.toString() || '',
    sleepDuration: existingRecord?.sleepDuration?.toString() || '',
    sleepTime: existingRecord?.sleepTime || '',
    sleepScore: existingRecord?.sleepScore?.toString() || '',
    restingHeartRate: existingRecord?.restingHeartRate?.toString() || '',
    bloodPressureSystolic: existingRecord?.bloodPressureSystolic?.toString() || '',
    bloodPressureDiastolic: existingRecord?.bloodPressureDiastolic?.toString() || '',
    stressLevel: existingRecord?.stressLevel?.toString() || '',
    didWorkout: existingRecord?.trainingDuration ? 'yes' : 'no',
    trainingDuration: existingRecord?.trainingDuration?.toString() || '',
    caloriesBurned: existingRecord?.caloriesBurned?.toString() || '',
    trainingFeeling: existingRecord?.trainingFeeling || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const record: Partial<DailyHealthRecord> = {};
    
    if (formData.weight) record.weight = parseFloat(formData.weight);
    if (formData.sleepDuration) record.sleepDuration = parseFloat(formData.sleepDuration);
    if (formData.sleepTime) record.sleepTime = formData.sleepTime;
    if (formData.sleepScore) record.sleepScore = parseInt(formData.sleepScore);
    if (formData.restingHeartRate) record.restingHeartRate = parseInt(formData.restingHeartRate);
    if (formData.bloodPressureSystolic) record.bloodPressureSystolic = parseInt(formData.bloodPressureSystolic);
    if (formData.bloodPressureDiastolic) record.bloodPressureDiastolic = parseInt(formData.bloodPressureDiastolic);
    if (formData.stressLevel) record.stressLevel = parseInt(formData.stressLevel);
    
    // 如果选择了健身，保存训练数据
    if (formData.didWorkout === 'yes') {
      record.trainingDuration = formData.trainingDuration ? parseInt(formData.trainingDuration) : 0;
      record.caloriesBurned = formData.caloriesBurned ? parseInt(formData.caloriesBurned) : 0;
      if (formData.trainingFeeling) {
        record.trainingFeeling = formData.trainingFeeling as 'easy' | 'medium' | 'hard';
      }
    } else {
      // 没有健身，训练数据设为0
      record.trainingDuration = 0;
      record.caloriesBurned = 0;
      record.trainingFeeling = undefined;
    }

    onSave(record);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl border border-gray-700"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">健康记录</h3>
            <p className="text-sm text-gray-400 mt-1">{selectedDate}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">体重 (kg)</label>
            <input
              type="number"
              value={formData.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              placeholder="68.5"
              className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">睡眠时长 (小时)</label>
              <input
                type="number"
                step="0.1"
                value={formData.sleepDuration}
                onChange={(e) => handleChange('sleepDuration', e.target.value)}
                placeholder="7.5"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">入睡时间</label>
              <input
                type="time"
                value={formData.sleepTime}
                onChange={(e) => handleChange('sleepTime', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">睡眠评分 (0-100)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.sleepScore}
              onChange={(e) => handleChange('sleepScore', e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>0</span>
              <span className="text-white font-medium">{formData.sleepScore || 0}</span>
              <span>100</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">心率 (bpm)</label>
              <input
                type="number"
                value={formData.restingHeartRate}
                onChange={(e) => handleChange('restingHeartRate', e.target.value)}
                placeholder="72"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">血压高压</label>
              <input
                type="number"
                value={formData.bloodPressureSystolic}
                onChange={(e) => handleChange('bloodPressureSystolic', e.target.value)}
                placeholder="120"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">血压低压</label>
              <input
                type="number"
                value={formData.bloodPressureDiastolic}
                onChange={(e) => handleChange('bloodPressureDiastolic', e.target.value)}
                placeholder="80"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 压力水平 */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">压力水平 (0-100)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.stressLevel}
              onChange={(e) => handleChange('stressLevel', e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>0</span>
              <span className="text-white font-medium">{formData.stressLevel || 0}</span>
              <span>100</span>
            </div>
          </div>

          {/* 是否健身 */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">今天是否健身</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleChange('didWorkout', 'yes')}
                className={`py-3 rounded-xl font-medium transition-all ${
                  formData.didWorkout === 'yes'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                💪 是
              </button>
              <button
                onClick={() => handleChange('didWorkout', 'no')}
                className={`py-3 rounded-xl font-medium transition-all ${
                  formData.didWorkout === 'no'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                休息日
              </button>
            </div>
          </div>

          {/* 训练相关字段 - 只有选择了健身后才显示 */}
          {formData.didWorkout === 'yes' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">训练时长 (分钟)</label>
                  <input
                    type="number"
                    value={formData.trainingDuration}
                    onChange={(e) => handleChange('trainingDuration', e.target.value)}
                    placeholder="45"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">消耗卡路里</label>
                  <input
                    type="number"
                    value={formData.caloriesBurned}
                    onChange={(e) => handleChange('caloriesBurned', e.target.value)}
                    placeholder="320"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">训练感受</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'easy', label: '轻松' },
                    { key: 'medium', label: '适中' },
                    { key: 'hard', label: '吃力' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => handleChange('trainingFeeling', option.key)}
                      className={`py-2 rounded-xl font-medium transition-all ${
                        formData.trainingFeeling === option.key
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function HeartRateZonesChart() {
  const [zones, setZones] = useState([
    { zone: 1, label: '热身', color: '#8E8E93', percent: 30, time: 45 },
    { zone: 2, label: '轻度', color: '#007AFF', percent: 35, time: 52 },
    { zone: 3, label: '有氧', color: '#34C759', percent: 25, time: 37 },
    { zone: 4, label: '阈值', color: '#FF9500', percent: 8, time: 12 },
    { zone: 5, label: '极限', color: '#FF3B30', percent: 2, time: 3 },
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-red-400" />
          <span className="font-semibold text-white">心率区间分布</span>
        </div>
        
        <div className="space-y-3">
          {zones.map((zone) => (
            <div key={zone.zone} className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: zone.color }} />
                  <span className="text-gray-300">Zone {zone.zone}</span>
                  <span className="text-gray-500">({zone.label})</span>
                </div>
                <div className="text-gray-400">
                  <span className="text-white font-medium">{zone.percent}%</span>
                  <span className="ml-2 text-xs">{zone.time}分钟</span>
                </div>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: zone.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${zone.percent}%` }}
                  transition={{ duration: 0.8, delay: zone.zone * 0.1 }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function SleepAnalysisChart() {
  const [sleepData, setSleepData] = useState({
    deep: 85,
    rem: 90,
    light: 180,
    awake: 15,
  });

  const total = sleepData.deep + sleepData.rem + sleepData.light + sleepData.awake;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">睡眠阶段分析</span>
          </div>
          <span className="text-2xl font-bold text-blue-400">{total}分钟</span>
        </div>
        
        <div className="flex h-8 rounded-full overflow-hidden mb-4">
          <motion.div
            className="bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${(sleepData.deep / total) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />
          <motion.div
            className="bg-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${(sleepData.rem / total) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
          <motion.div
            className="bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${(sleepData.light / total) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
          <motion.div
            className="bg-gray-600"
            initial={{ width: 0 }}
            animate={{ width: `${(sleepData.awake / total) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-indigo-600" />
            <div>
              <p className="text-white font-medium">{sleepData.deep}分钟</p>
              <p className="text-xs text-gray-400">深睡</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-600" />
            <div>
              <p className="text-white font-medium">{sleepData.rem}分钟</p>
              <p className="text-xs text-gray-400">REM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-600" />
            <div>
              <p className="text-white font-medium">{sleepData.light}分钟</p>
              <p className="text-xs text-gray-400">浅睡</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-600" />
            <div>
              <p className="text-white font-medium">{sleepData.awake}分钟</p>
              <p className="text-xs text-gray-400">清醒</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ATLCTLChart() {
  const [atl, setAtl] = useState([42, 45, 48, 52, 55, 58, 62, 65, 68, 70, 72, 74]);
  const [ctl, setCtl] = useState([60, 62, 63, 65, 66, 67, 68, 70, 71, 72, 73, 75]);
  const [days] = useState([...Array(12).keys()].map(i => `Day ${i + 1}`));

  const latestATL = atl[atl.length - 1];
  const latestCTL = ctl[ctl.length - 1];
  const tsb = latestCTL - latestATL;

  const getTSBStatus = () => {
    if (tsb > 25) return { text: '充分恢复', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (tsb > 5) return { text: '状态良好', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (tsb > -5) return { text: '平衡', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { text: '疲劳积累', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const tsbStatus = getTSBStatus();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-white">训练负荷 (TSB)</span>
          </div>
          <div className={`px-3 py-1 rounded-full ${tsbStatus.bg}`}>
            <span className={`text-sm font-medium ${tsbStatus.color}`}>
              {tsbStatus.text}
            </span>
          </div>
        </div>

        <div className="h-48 relative mb-4">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="atlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="ctlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            
            <polyline
              points={atl.map((v, i) => `${(i / (atl.length - 1)) * 100},${100 - v}`).join(' ')}
              fill="none"
              stroke="#EF4444"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={ctl.map((v, i) => `${(i / (ctl.length - 1)) * 100},${100 - v}`).join(' ')}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500">
            <span>12天前</span>
            <span>今天</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-red-500/10 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">短期负荷 (ATL)</p>
            <p className="text-2xl font-bold text-red-400">{latestATL}</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">长期负荷 (CTL)</p>
            <p className="text-2xl font-bold text-blue-400">{latestCTL}</p>
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-red-400" />
            <span className="text-gray-400">ATL</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-400" />
            <span className="text-gray-400">CTL</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function TrendsPage() {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter">("month");
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<"weight" | "sleepScore" | "stressLevel" | "restingHeartRate">("weight");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTrends();
  }, [timeRange, selectedMetric]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === "month") {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setDate(startDate.getDate() - 90);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // 获取指标历史数据
      const historyData = await getMetricHistory(
        selectedMetric === "stressLevel" ? "stressLevel" :
        selectedMetric === "restingHeartRate" ? "restingHeartRate" :
        selectedMetric,
        startStr,
        endStr
      );

      setChartData(historyData.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const metricConfig = {
    weight: { 
      color: '#10B981', 
      label: '体重', 
      unit: 'kg',
      icon: <Activity className="w-4 h-4" />
    },
    sleepScore: { 
      color: '#3B82F6', 
      label: '睡眠评分', 
      unit: '分',
      icon: <Moon className="w-4 h-4" />
    },
    stressLevel: { 
      color: '#A855F7', 
      label: '压力', 
      unit: '',
      icon: <Brain className="w-4 h-4" />
    },
    restingHeartRate: { 
      color: '#EC4899', 
      label: '心率', 
      unit: 'bpm',
      icon: <Heart className="w-4 h-4" />
    },
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getStats = () => {
    if (chartData.length === 0) return { avg: 0, max: 0, min: 0 };
    const values = chartData.map(d => d.value);
    return {
      avg: (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1),
      max: Math.max(...values),
      min: Math.min(...values),
    };
  };

  const stats = getStats();

  return (
    <div className="space-y-4">
      {/* 时间范围选择 */}
      <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl">
        {([
          { key: "week", label: "周" },
          { key: "month", label: "月" },
          { key: "quarter", label: "季" },
        ] as const).map((range) => (
          <button
            key={range.key}
            onClick={() => setTimeRange(range.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === range.key
                ? "bg-indigo-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            近{range.label}
          </button>
        ))}
      </div>

      {/* 指标选择 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.entries(metricConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedMetric(key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedMetric === key
                ? "text-white"
                : "bg-gray-800/50 text-gray-400"
            }`}
            style={{
              backgroundColor: selectedMetric === key ? config.color : undefined,
            }}
          >
            {config.icon}
            {config.label}
          </button>
        ))}
      </div>

      {/* 趋势图表 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-white flex items-center gap-2">
            {metricConfig[selectedMetric].icon}
            {metricConfig[selectedMetric].label}趋势
          </span>
          <span className="text-sm text-gray-400">
            {chartData.length} 条记录
          </span>
        </div>
        
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                tickFormatter={formatDate}
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={(label) => formatDate(label as string)}
                  formatter={(value: any) => [`${value} ${metricConfig[selectedMetric].unit}`, metricConfig[selectedMetric].label]}
                />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={metricConfig[selectedMetric].color} 
                strokeWidth={2}
                dot={{ fill: metricConfig[selectedMetric].color, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center bg-gray-800/30 rounded-xl">
            <div className="text-center">
              <p className="text-gray-400 mb-2">暂无{metricConfig[selectedMetric].label}数据</p>
              <p className="text-sm text-gray-500">请先在"今日"页面添加健康记录</p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{timeRange === "week" ? "7天前" : timeRange === "month" ? "30天前" : "90天前"}</span>
          <span>今天</span>
        </div>
      </Card>

      {/* 统计卡片 */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              平均值
            </div>
            <div className="text-2xl font-bold" style={{ color: metricConfig[selectedMetric].color }}>
              {stats.avg}
              <span className="text-sm font-normal text-gray-400 ml-1">
                {metricConfig[selectedMetric].unit}
              </span>
            </div>
          </Card>
          <Card>
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              最大值
            </div>
            <div className="text-2xl font-bold text-green-400">
              {stats.max}
              <span className="text-sm font-normal text-gray-400 ml-1">
                {metricConfig[selectedMetric].unit}
              </span>
            </div>
          </Card>
          <Card>
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              最小值
            </div>
            <div className="text-2xl font-bold text-red-400">
              {stats.min}
              <span className="text-sm font-normal text-gray-400 ml-1">
                {metricConfig[selectedMetric].unit}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* 提示信息 */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-blue-300 text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          点击"今日"页面的指标卡片可查看更多趋势分析和历史对比
        </p>
      </div>
    </div>
  );
}

function JournalPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<any[]>([]);
  const [showCustomTagModal, setShowCustomTagModal] = useState(false);
  const [newCustomTag, setNewCustomTag] = useState({ label: '', icon: '🏷️', category: 'custom' });

  useEffect(() => {
    loadEntries();
    loadCustomTags();
  }, []);

  const loadEntries = async () => {
    const data = await getRecentJournalEntries(30);
    setEntries(data);
  };

  const loadCustomTags = () => {
    const saved = localStorage.getItem('customJournalTags');
    if (saved) {
      setCustomTags(JSON.parse(saved));
    }
  };

  const handleAddTag = async (tagKey: string, category: string) => {
    const today = new Date().toISOString().split('T')[0];
    await addJournalEntry({
      date: today,
      timestamp: Date.now(),
      tags: [tagKey],
      category: category as any,
    });
    showToast({ message: "已添加标签", type: "success", duration: 2000 });
    loadEntries();
    setShowAddModal(false);
  };

  const handleAddCustomTag = () => {
    if (!newCustomTag.label.trim()) {
      showToast({ message: "请输入标签名称", type: "error", duration: 2000 });
      return;
    }

    const tagKey = `custom_${Date.now()}`;
    const updated = [...customTags, { ...newCustomTag, key: tagKey }];
    setCustomTags(updated);
    localStorage.setItem('customJournalTags', JSON.stringify(updated));
    setNewCustomTag({ label: '', icon: '🏷️', category: 'custom' });
    setShowCustomTagModal(false);
    showToast({ message: "自定义标签已创建", type: "success", duration: 2000 });
  };

  const handleDeleteCustomTag = (tagKey: string) => {
    const updated = customTags.filter(t => t.key !== tagKey);
    setCustomTags(updated);
    localStorage.setItem('customJournalTags', JSON.stringify(updated));
    showToast({ message: "标签已删除", type: "success", duration: 2000 });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'caffeine': return <Coffee className="w-4 h-4" />;
      case 'alcohol': return <Wine className="w-4 h-4" />;
      case 'sleep': return <Moon className="w-4 h-4" />;
      case 'screen': return <Monitor className="w-4 h-4" />;
      case 'travel': return <Plane className="w-4 h-4" />;
      case 'work': return <Briefcase className="w-4 h-4" />;
      case 'custom': return <Target className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'caffeine': return "bg-amber-500/20 text-amber-400";
      case 'alcohol': return "bg-purple-500/20 text-purple-400";
      case 'sleep': return "bg-blue-500/20 text-blue-400";
      case 'screen': return "bg-indigo-500/20 text-indigo-400";
      case 'travel': return "bg-cyan-500/20 text-cyan-400";
      case 'work': return "bg-red-500/20 text-red-400";
      case 'custom': return "bg-pink-500/20 text-pink-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const groupedEntries = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const getTagLabel = (tagKey: string, category: string) => {
    if (category === 'custom') {
      const customTag = customTags.find(t => t.key === tagKey);
      return customTag ? `${customTag.icon} ${customTag.label}` : tagKey;
    }
    const tags = JOURNAL_TAGS[category as keyof typeof JOURNAL_TAGS];
    const tag = tags?.find(t => t.key === tagKey);
    return tag ? `${tag.icon} ${tag.label}` : tagKey;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          添加日志
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCustomTagModal(true)}
          className="py-3 px-4 bg-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <Settings className="w-5 h-5" />
        </motion.button>
      </div>

      {customTags.length > 0 && (
        <Card className="border-pink-500/30">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-pink-400" />
            <span className="font-semibold text-white">自定义标签</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {customTags.map((tag) => (
              <div key={tag.key} className="relative group">
                <button
                  onClick={() => handleAddTag(tag.key, 'custom')}
                  className="px-3 py-1.5 bg-pink-500/20 text-pink-400 rounded-lg text-sm hover:bg-pink-500/30 transition-colors"
                >
                  {tag.icon} {tag.label}
                </button>
                <button
                  onClick={() => handleDeleteCustomTag(tag.key)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Object.keys(groupedEntries).length > 0 ? (
        Object.entries(groupedEntries).map(([date, dayEntries]) => (
          <div key={date}>
            <h3 className="text-sm text-gray-400 mb-2">{date}</h3>
            <div className="space-y-2">
              {dayEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className={`p-2 rounded-lg ${getCategoryColor(entry.category)}`}>
                    {getCategoryIcon(entry.category)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {getTagLabel(entry.tags[0], entry.category)}
                    </p>
                    <p className="text-xs text-gray-500">{entry.category}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <Card className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">暂无日志记录</p>
          <p className="text-sm text-gray-500 mt-1">记录影响恢复的生活方式事件</p>
        </Card>
      )}

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700 max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold text-white mb-4">添加日志标签</h3>
              
              <div className="space-y-4">
                {Object.entries(JOURNAL_TAGS).map(([category, tags]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={getCategoryColor(category)}>{getCategoryIcon(category)}</span>
                      <span className="text-sm font-medium text-gray-300 capitalize">{category}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag.key}
                          onClick={() => handleAddTag(tag.key, category)}
                          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
                        >
                          {tag.icon} {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="mt-6 w-full py-2 text-gray-400 hover:text-white"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomTagModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCustomTagModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700"
            >
              <h3 className="text-lg font-semibold text-white mb-4">创建自定义标签</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">标签名称</label>
                  <input
                    type="text"
                    value={newCustomTag.label}
                    onChange={(e) => setNewCustomTag({ ...newCustomTag, label: e.target.value })}
                    placeholder="例如：冥想、拉伸"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">选择图标</label>
                  <div className="grid grid-cols-8 gap-2">
                    {['🏷️', '🧘', '💆', '📚', '🎵', '☕', '🍵', '🌿', '💪', '🧠', '❤️', '✨', '🎯', '⏰', '🌙', '☀️'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewCustomTag({ ...newCustomTag, icon: emoji })}
                        className={`p-2 text-xl rounded-lg transition-all ${
                          newCustomTag.icon === emoji
                            ? 'bg-pink-500 text-white'
                            : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {customTags.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">已有标签（点击删除）</label>
                    <div className="flex flex-wrap gap-2">
                      {customTags.map((tag) => (
                        <button
                          key={tag.key}
                          onClick={() => handleDeleteCustomTag(tag.key)}
                          className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30"
                        >
                          {tag.icon} {tag.label} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCustomTagModal(false)}
                  className="flex-1 py-2 border border-gray-700 rounded-xl text-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleAddCustomTag}
                  className="flex-1 py-2 bg-pink-500 rounded-xl text-white font-medium"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkoutAnalysisCard({ workout }: { workout: any }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const heartRateZones = [
    { zone: 1, label: '热身', color: '#8E8E93', percent: 25, time: 15 },
    { zone: 2, label: '轻度', color: '#007AFF', percent: 35, time: 21 },
    { zone: 3, label: '有氧', color: '#34C759', percent: 28, time: 17 },
    { zone: 4, label: '阈值', color: '#FF9500', percent: 10, time: 6 },
    { zone: 5, label: '极限', color: '#FF3B30', percent: 2, time: 1 },
  ];

  const muscleGroups = [
    { name: '胸部', load: 75, color: '#EF4444' },
    { name: '背部', load: 60, color: '#F97316' },
    { name: '腿部', load: 85, color: '#EAB308' },
    { name: '肩部', load: 50, color: '#22C55E' },
    { name: '手臂', load: 65, color: '#14B8A6' },
    { name: '核心', load: 45, color: '#3B82F6' },
  ];

  return (
    <Card>
      <div 
        className="cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{WORKOUT_TYPES.find(t => t.key === workout.type)?.icon || '🏃'}</span>
          <div className="flex-1">
            <p className="text-white font-medium">
              {WORKOUT_TYPES.find(t => t.key === workout.type)?.label || workout.type}
            </p>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>⏱️ {workout.duration}分钟</span>
              <span>🔥 {workout.calories}卡</span>
              {workout.heartRateAvg && <span>❤️ {workout.heartRateAvg} BPM</span>}
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-white">心率区间</span>
              </div>
              <div className="space-y-2">
                {heartRateZones.map((zone) => (
                  <div key={zone.zone} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: zone.color }} />
                        <span className="text-gray-400">Zone {zone.zone} ({zone.label})</span>
                      </div>
                      <span className="text-gray-300">{zone.percent}% · {zone.time}分钟</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ 
                          width: `${zone.percent}%`,
                          backgroundColor: zone.color 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-white">肌肉负荷 (Muscle Load)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {muscleGroups.map((group) => (
                  <div key={group.name} className="text-center p-2 bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">{group.name}</p>
                    <div className="relative h-12 flex items-end justify-center">
                      <div
                        className="w-8 rounded-t transition-all"
                        style={{
                          height: `${group.load}%`,
                          backgroundColor: group.color,
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <p className="text-sm font-medium text-white mt-1">{group.load}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700">
              <div>
                <p className="text-xs text-gray-400 mb-1">努力值 (Effort)</p>
                <p className="text-lg font-bold text-orange-400">78%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">有氧/无氧</p>
                <p className="text-lg font-bold text-blue-400">72/28%</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function WorkoutPage() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [heartRateAvg, setHeartRateAvg] = useState("");
  
  const [distance, setDistance] = useState("");
  const [pace, setPace] = useState("");
  const [elevationGain, setElevationGain] = useState("");
  const [incline, setIncline] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    const data = await getRecentWorkouts(20);
    setWorkouts(data);
  };

  const handleAddWorkout = async () => {
    if (!selectedType || !duration) {
      showToast({ message: "请填写完整信息", type: "error", duration: 2000 });
      return;
    }

    const today = new Date();
    const now = Date.now();
    
    const record: any = {
      type: selectedType,
      duration: parseInt(duration),
      calories: parseInt(calories) || Math.round(parseInt(duration) * 8),
      heartRateAvg: heartRateAvg ? parseInt(heartRateAvg) : undefined,
      startTime: now - parseInt(duration) * 60 * 1000,
      endTime: now,
      date: today.toISOString().split('T')[0],
      source: 'manual',
    };

    if (selectedType === 'running_outdoor' || selectedType === 'running_indoor' || selectedType === 'hiking_indoor') {
      if (distance) record.distance = parseFloat(distance);
      if (pace) record.pace = parseFloat(pace);
      if (elevationGain) record.elevationGain = parseInt(elevationGain);
    }

    if (selectedType === 'hiking_indoor') {
      if (incline) record.incline = parseFloat(incline);
    }

    if (selectedType === 'strength') {
      if (exerciseName) record.exerciseName = exerciseName;
      if (weight) record.weight = parseFloat(weight);
      if (reps) record.reps = parseInt(reps);
      if (sets) record.sets = parseInt(sets);
    }

    await addWorkoutRecord(record);

    showToast({ message: "训练已记录", type: "success", duration: 2000 });
    setShowAddModal(false);
    setSelectedType(null);
    setDuration("");
    setCalories("");
    setHeartRateAvg("");
    setDistance("");
    setPace("");
    setElevationGain("");
    setIncline("");
    setExerciseName("");
    setWeight("");
    setReps("");
    setSets("");
    loadWorkouts();
  };

  const isRunningType = (type: string | null) => type === 'running_outdoor' || type === 'running_indoor';
  const isStrengthType = (type: string | null) => type === 'strength';
  const isHikingType = (type: string | null) => type === 'hiking_indoor';

  const groupedWorkouts = workouts.reduce<Record<string, typeof workouts>>((acc, workout) => {
    if (!acc[workout.date]) acc[workout.date] = [];
    acc[workout.date].push(workout);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        添加训练
      </motion.button>

      {Object.keys(groupedWorkouts).length > 0 ? (
        Object.entries(groupedWorkouts).map(([date, dayWorkouts]) => (
          <div key={date}>
            <h3 className="text-sm text-gray-400 mb-2">{date}</h3>
            <div className="space-y-2">
              {dayWorkouts.map((workout) => (
                <WorkoutAnalysisCard key={workout.id} workout={workout} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <Card className="text-center py-8">
          <Dumbbell className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">暂无训练记录</p>
          <p className="text-sm text-gray-500 mt-1">记录你的每一次训练</p>
        </Card>
      )}

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700 max-h-[85vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold text-white mb-4">添加训练</h3>

              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">训练类型</label>
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {WORKOUT_TYPES.map((type) => (
                    <button
                      key={type.key}
                      onClick={() => setSelectedType(type.key)}
                      className={`p-3 rounded-xl text-center ${
                        selectedType === type.key
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      <span className="text-2xl block">{type.icon}</span>
                      <span className="text-xs mt-1 block">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">时长（分钟）</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="30"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">卡路里</label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="自动计算"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">平均心率（可选）</label>
                <input
                  type="number"
                  value={heartRateAvg}
                  onChange={(e) => setHeartRateAvg(e.target.value)}
                  placeholder="145"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {(isRunningType(selectedType) || isHikingType(selectedType)) && (
                <div className="space-y-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">距离（公里）</label>
                      <input
                        type="number"
                        step="0.1"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        placeholder="5.0"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">平均配速（分/公里）</label>
                      <input
                        type="number"
                        step="0.1"
                        value={pace}
                        onChange={(e) => setPace(e.target.value)}
                        placeholder="6.5"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">爬升高度（米）</label>
                    <input
                      type="number"
                      value={elevationGain}
                      onChange={(e) => setElevationGain(e.target.value)}
                      placeholder="100"
                      className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {isHikingType(selectedType) && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">坡度（%）</label>
                  <input
                    type="number"
                    step="0.1"
                    value={incline}
                    onChange={(e) => setIncline(e.target.value)}
                    placeholder="10.0"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {isStrengthType(selectedType) && (
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">动作名称</label>
                    <input
                      type="text"
                      value={exerciseName}
                      onChange={(e) => setExerciseName(e.target.value)}
                      placeholder="深蹲"
                      className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">重量（kg）</label>
                      <input
                        type="number"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="40"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">次数</label>
                      <input
                        type="number"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder="12"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">组数</label>
                      <input
                        type="number"
                        value={sets}
                        onChange={(e) => setSets(e.target.value)}
                        placeholder="4"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-gray-700 rounded-xl text-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleAddWorkout}
                  className="flex-1 py-2 bg-indigo-500 rounded-xl text-white font-medium"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TRAINING_MODES_CONFIG = [
  {
    key: 'amrap',
    label: 'AMRAP',
    fullName: 'As Many Rounds As Possible',
    description: '固定时间内尽可能完成多轮训练',
    icon: '⏱️',
    color: '#EF4444',
    typicalDuration: '8-20分钟',
    rules: [
      '设定固定时间（8-20分钟）',
      '在时间内完成尽可能多的完整训练循环',
      '记录完成的总轮数',
      '适合 HIIT 和功能性训练'
    ],
  },
  {
    key: 'emom',
    label: 'EMOM',
    fullName: 'Every Minute On the Minute',
    description: '每分钟完成规定动作，剩余时间休息',
    icon: '⏰',
    color: '#F97316',
    typicalDuration: '8-16分钟',
    rules: [
      '每分钟开始时开始执行动作',
      '在分钟结束前完成规定次数/时间',
      '剩余时间为休息',
      '可设置递增难度'
    ],
  },
  {
    key: 'interval',
    label: '间歇训练',
    fullName: 'Interval Training',
    description: '高强度工作和休息交替进行',
    icon: '⚡',
    color: '#EAB308',
    typicalDuration: '4-20分钟',
    rules: [
      '工作时间和休息时间交替',
      '可设置多轮循环',
      '工作强度高于休息强度',
      '适合提高心肺功能和代谢'
    ],
  },
  {
    key: 'opengym',
    label: '开放训练',
    fullName: 'Open Gym',
    description: '最灵活的训练模式，自由组合动作',
    icon: '🏋️',
    color: '#22C55E',
    typicalDuration: '自定义',
    rules: [
      '完全自定义训练内容',
      '可设置多组动作',
      '自定义组间休息时间',
      '适合力量训练和自主训练'
    ],
  },
  {
    key: 'fortime',
    label: '计时完成',
    fullName: 'For Time',
    description: '规定训练量下尽可能快完成',
    icon: '🎯',
    color: '#3B82F6',
    typicalDuration: '自定义',
    rules: [
      '规定固定的训练量',
      '尽可能快地完成所有内容',
      '记录完成总时间',
      '适合挑战个人记录'
    ],
  },
];

function TrainingModeCard({ mode }: { mode: typeof TRAINING_MODES_CONFIG[0] }) {
  const [showRules, setShowRules] = useState(false);

  return (
    <Card 
      className="cursor-pointer hover:border-opacity-100 transition-all"
      onClick={() => setShowRules(!showRules)}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${mode.color}20` }}
        >
          {mode.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">{mode.label}</h3>
            <span className="text-xs text-gray-400">{mode.typicalDuration}</span>
          </div>
          <p className="text-sm text-gray-400 mb-1">{mode.fullName}</p>
          <p className="text-sm text-gray-500">{mode.description}</p>
        </div>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showRules ? 'rotate-90' : ''}`} />
      </div>

      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-gray-700 overflow-hidden"
          >
            <h4 className="text-sm font-medium text-white mb-2">训练规则：</h4>
            <ul className="space-y-1">
              {mode.rules.map((rule, index) => (
                <li key={index} className="text-sm text-gray-400 flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="mt-4 w-full py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: mode.color }}
            >
              开始 {mode.label} 训练
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function MuscleBuildingPage() {
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null);
  
  const programs = [
    {
      id: 1,
      title: "新手增肌计划",
      duration: "8周",
      level: "初级",
      description: "专为初学者设计的全身训练计划，重点建立运动基础",
      sessions: "每周3次",
      focus: ['全身训练', '基础力量', '动作规范'],
      color: '#10B981'
    },
    {
      id: 2,
      title: "上肢强化",
      duration: "6周",
      level: "中级",
      description: "针对胸、背、肩、手臂的系统训练，打造上半身线条",
      sessions: "每周4次",
      focus: ['胸部', '背部', '肩部', '手臂'],
      color: '#3B82F6'
    },
    {
      id: 3,
      title: "下肢力量",
      duration: "6周",
      level: "中级",
      description: "专注下肢肌群训练，提升爆发力和稳定性",
      sessions: "每周3次",
      focus: ['深蹲', '硬拉', '腿举'],
      color: '#8B5CF6'
    },
    {
      id: 4,
      title: "分化训练",
      duration: "12周",
      level: "高级",
      description: "经典五天分化训练，最大化肌肉刺激",
      sessions: "每周5次",
      focus: ['胸背腿', '推拉腿', '循环训练'],
      color: '#EF4444'
    }
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700/30">
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp className="w-6 h-6 text-green-400" />
          <div>
            <h3 className="text-lg font-bold text-white">增肌训练</h3>
            <p className="text-sm text-gray-400">科学增肌，塑造完美体型</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-400">8-12</p>
            <p className="text-xs text-gray-400">最佳次数</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-400">60-90</p>
            <p className="text-xs text-gray-400">秒休息(秒)</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-400">3-5</p>
            <p className="text-xs text-gray-400">最佳组数</p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">推荐计划</h2>
        <div className="space-y-3">
          {programs.map((program) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: program.id * 0.1 }}
            >
              <Card 
                className="cursor-pointer hover:border-opacity-100 transition-all"
                onClick={() => setSelectedProgram(selectedProgram === program.id ? null : program.id)}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${program.color}20` }}
                  >
                    💪
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{program.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${program.color}30`, color: program.color }}>
                        {program.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{program.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>⏱️ {program.duration}</span>
                      <span>📅 {program.sessions}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedProgram === program.id ? 'rotate-90' : ''}`} />
                </div>

                <AnimatePresence>
                  {selectedProgram === program.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-gray-700 overflow-hidden"
                    >
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-white mb-2">训练重点：</h4>
                        <div className="flex flex-wrap gap-2">
                          {program.focus.map((item, idx) => (
                            <span key={idx} className="px-3 py-1 bg-gray-700/50 rounded-full text-xs text-gray-300">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-2.5 rounded-xl text-white font-medium"
                        style={{ backgroundColor: program.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast({ message: `${program.title}已开始！`, type: "success", duration: 2000 });
                        }}
                      >
                        开始训练
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <Card className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-700/30">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">增肌小贴士</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span>保证充足睡眠，每晚7-9小时</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span>蛋白质摄入：每公斤体重1.6-2.2克</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-1">•</span>
            <span>渐进超负荷：每周适当增加重量或次数</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function FatLossPage() {
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null);
  
  const programs = [
    {
      id: 1,
      title: "HIIT燃脂",
      duration: "20分钟",
      level: "初级",
      description: "高强度间歇训练，快速燃烧脂肪",
      calories: "300-400",
      focus: ['全身燃脂', '心肺提升', '时间效率'],
      color: '#F97316'
    },
    {
      id: 2,
      title: "空腹有氧",
      duration: "30-45分钟",
      level: "中级",
      description: "早晨空腹有氧训练，加速脂肪燃烧",
      calories: "400-500",
      focus: ['脂肪燃烧', '空腹训练', '代谢启动'],
      color: '#EF4444'
    },
    {
      id: 3,
      title: "循环训练",
      duration: "45分钟",
      level: "中级",
      description: "力量+有氧结合，最大化热量消耗",
      calories: "500-600",
      focus: ['力量耐力', '卡路里消耗', '肌肉保持'],
      color: '#DC2626'
    },
    {
      id: 4,
      title: "阶梯训练",
      duration: "40分钟",
      level: "高级",
      description: "多层次强度变化，持续燃脂",
      calories: "450-550",
      focus: ['代谢调节', '心肺挑战', '意志力锻炼'],
      color: '#B91C1C'
    }
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border-orange-700/30">
        <div className="flex items-center gap-3 mb-3">
          <Flame className="w-6 h-6 text-orange-400" />
          <div>
            <h3 className="text-lg font-bold text-white">减脂训练</h3>
            <p className="text-sm text-gray-400">高效燃脂，塑造纤细身材</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-orange-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-orange-400">65-75%</p>
            <p className="text-xs text-gray-400">最佳心率</p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-orange-400">30-45</p>
            <p className="text-xs text-gray-400">分钟时长</p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-orange-400">3-4</p>
            <p className="text-xs text-gray-400">每周次数</p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">减脂方案</h2>
        <div className="space-y-3">
          {programs.map((program) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: program.id * 0.1 }}
            >
              <Card 
                className="cursor-pointer hover:border-opacity-100 transition-all"
                onClick={() => setSelectedProgram(selectedProgram === program.id ? null : program.id)}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${program.color}20` }}
                  >
                    🔥
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{program.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${program.color}30`, color: program.color }}>
                        {program.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{program.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>⏱️ {program.duration}</span>
                      <span>🔥 {program.calories}卡</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedProgram === program.id ? 'rotate-90' : ''}`} />
                </div>

                <AnimatePresence>
                  {selectedProgram === program.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-gray-700 overflow-hidden"
                    >
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-white mb-2">训练特点：</h4>
                        <div className="flex flex-wrap gap-2">
                          {program.focus.map((item, idx) => (
                            <span key={idx} className="px-3 py-1 bg-gray-700/50 rounded-full text-xs text-gray-300">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-2.5 rounded-xl text-white font-medium"
                        style={{ backgroundColor: program.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast({ message: `${program.title}已开始！`, type: "success", duration: 2000 });
                        }}
                      >
                        开始训练
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <Card className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border-red-700/30">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-white">减脂小贴士</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-red-400 mt-1">•</span>
            <span>控制饮食，制造300-500卡路里赤字</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 mt-1">•</span>
            <span>训练前后补充蛋白质，减少肌肉流失</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 mt-1">•</span>
            <span>保持训练强度，避免低效的"排汗"训练</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function CardioPage() {
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null);
  
  const programs = [
    {
      id: 1,
      title: "慢跑耐力",
      duration: "30-60分钟",
      level: "初级",
      description: "轻松跑，建立有氧基础",
      distance: "5-10公里",
      focus: ['有氧基础', '耐力提升', '习惯养成'],
      color: '#3B82F6'
    },
    {
      id: 2,
      title: "间歇冲刺",
      duration: "25分钟",
      level: "中级",
      description: "跑走结合，提升心肺功能",
      distance: "4-5公里",
      focus: ['心肺提升', '速度进步', '代谢增强'],
      color: '#06B6D4'
    },
    {
      id: 3,
      title: "节奏跑",
      duration: "40分钟",
      level: "中级",
      description: "稳定配速跑，提高乳酸阈值",
      distance: "6-8公里",
      focus: ['配速控制', '阈值训练', '跑步经济性'],
      color: '#0EA5E9'
    },
    {
      id: 4,
      title: "长距离跑",
      duration: "60-120分钟",
      level: "高级",
      description: "超长距离慢跑，增强线粒体能力",
      distance: "10-21公里",
      focus: ['耐力极限', '脂肪代谢', '心理建设'],
      color: '#0284C7'
    }
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-700/30">
        <div className="flex items-center gap-3 mb-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-lg font-bold text-white">肺活量训练</h3>
            <p className="text-sm text-gray-400">提升心肺功能，增强耐力</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-400">130-150</p>
            <p className="text-xs text-gray-400">最佳心率</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-400">3-5</p>
            <p className="text-xs text-gray-400">每周次数</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-400">5-10%</p>
            <p className="text-xs text-gray-400">周跑量递增</p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">跑步方案</h2>
        <div className="space-y-3">
          {programs.map((program) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: program.id * 0.1 }}
            >
              <Card 
                className="cursor-pointer hover:border-opacity-100 transition-all"
                onClick={() => setSelectedProgram(selectedProgram === program.id ? null : program.id)}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${program.color}20` }}
                  >
                    🏃
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{program.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${program.color}30`, color: program.color }}>
                        {program.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{program.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>⏱️ {program.duration}</span>
                      <span>📍 {program.distance}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedProgram === program.id ? 'rotate-90' : ''}`} />
                </div>

                <AnimatePresence>
                  {selectedProgram === program.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-gray-700 overflow-hidden"
                    >
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-white mb-2">训练效果：</h4>
                        <div className="flex flex-wrap gap-2">
                          {program.focus.map((item, idx) => (
                            <span key={idx} className="px-3 py-1 bg-gray-700/50 rounded-full text-xs text-gray-300">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-2.5 rounded-xl text-white font-medium"
                        style={{ backgroundColor: program.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast({ message: `${program.title}已开始！`, type: "success", duration: 2000 });
                        }}
                      >
                        开始训练
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-700/30">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">肺活量小贴士</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>跑步时保持均匀呼吸，3步一吸3步一呼</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>注意跑前热身和跑后拉伸，防止受伤</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>每周跑量递增不超过10%，给身体恢复时间</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function OtherPage() {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/30">
        <div className="flex items-center gap-3 mb-3">
          <Trophy className="w-6 h-6 text-indigo-400" />
          <div>
            <h3 className="text-lg font-bold text-white">训练模式</h3>
            <p className="text-sm text-gray-400">选择训练模式，创建你的专属训练计划</p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">训练模式</h2>
        <div className="space-y-3">
          {TRAINING_MODES_CONFIG.map((mode) => (
            <TrainingModeCard key={mode.key} mode={mode} />
          ))}
        </div>
      </div>

      <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/30">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="font-bold text-white">分享码</h3>
            <p className="text-sm text-gray-400">生成分享码，让朋友也能使用你的训练</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="w-full py-2 bg-purple-500 text-white rounded-xl font-medium"
          onClick={() => showToast({ message: "分享码功能开发中...", type: "info", duration: 2000 })}
        >
          生成分享码
        </motion.button>
      </Card>
    </div>
  );
}

function TrainingPage() {
  const [activeSubTab, setActiveSubTab] = useState<'muscle' | 'fatloss' | 'cardio' | 'other'>('muscle');

  const subTabs = [
    { key: 'muscle' as const, label: '增肌', icon: '💪' },
    { key: 'fatloss' as const, label: '减脂', icon: '🔥' },
    { key: 'cardio' as const, label: '肺活量', icon: '🏃' },
    { key: 'other' as const, label: '其他', icon: '⚙️' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl border border-gray-700/50">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === tab.key
                ? 'bg-indigo-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'muscle' && (
          <motion.div
            key="muscle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <MuscleBuildingPage />
          </motion.div>
        )}
        {activeSubTab === 'fatloss' && (
          <motion.div
            key="fatloss"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <FatLossPage />
          </motion.div>
        )}
        {activeSubTab === 'cardio' && (
          <motion.div
            key="cardio"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <CardioPage />
          </motion.div>
        )}
        {activeSubTab === 'other' && (
          <motion.div
            key="other"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <OtherPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== Apple Health Import ====================

interface ParsedHealthData {
  workouts: any[];
  dailyMetrics: any[];
  sleepRecords: any[];
  heartRateRecords: any[];
  totalRecords: number;
}

export default function HealthPage() {
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  const tabs = [
    { key: "today" as TabType, label: "今日", icon: <Home className="w-5 h-5" /> },
    { key: "trends" as TabType, label: "趋势", icon: <TrendingUp className="w-5 h-5" /> },
    { key: "journal" as TabType, label: "日志", icon: <BookOpen className="w-5 h-5" /> },
    { key: "workout" as TabType, label: "运动", icon: <Dumbbell className="w-5 h-5" /> },
    { key: "training" as TabType, label: "训练", icon: <Trophy className="w-5 h-5" /> },
    { key: "muscle" as TabType, label: "肌肉", icon: <Activity className="w-5 h-5" /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      <div className="px-4 pt-6 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-white">健康中心</h1>
          <p className="text-sm text-gray-400 mt-1">每日健康记录与分析</p>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 bg-gray-800/50 rounded-xl border border-gray-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-indigo-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24" key={dataRefreshKey}>
        <AnimatePresence mode="wait">
          {activeTab === "today" && (
            <motion.div
              key="today"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TodayPage />
            </motion.div>
          )}
          {activeTab === "trends" && (
            <motion.div
              key="trends"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <TrendsPage />
            </motion.div>
          )}
          {activeTab === "journal" && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <JournalPage />
            </motion.div>
          )}
          {activeTab === "workout" && (
            <motion.div
              key="workout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <WorkoutPage />
            </motion.div>
          )}
          {activeTab === "training" && (
            <motion.div
              key="training"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <TrainingPage />
            </motion.div>
          )}
          {activeTab === "muscle" && (
            <motion.div
              key="muscle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MusclePage />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}