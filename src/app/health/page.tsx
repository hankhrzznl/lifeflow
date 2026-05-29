"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Heart, Droplets, Moon, Activity, Smile, Gauge, TrendingUp, Upload, Calendar, Plus, History, Database, ChevronRight, Target, Zap, Leaf, Star, Clock, ArrowUpDown } from "lucide-react";
import { addHealthRecord, getDailyHealthSummary, calculateHealthScore, getWeeklyHealthSummary, bulkAddHealthRecords, getHealthRecordsStats, getHealthRecordsGroupedByDate } from "@/lib/db";
import { HealthMetricType, HEALTH_METRIC_CONFIG, HealthRecord } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

type TabType = "dashboard" | "metrics" | "history" | "import";

interface MetricCardProps {
  metricType: HealthMetricType;
  value: number | undefined;
  target?: number;
  trend?: number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

function MetricCard({ metricType, value, target, trend, icon, color, gradient }: MetricCardProps) {
  const config = HEALTH_METRIC_CONFIG[metricType];
  const progress = value && target ? Math.min((value / target) * 100, 100) : 0;
  
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-4 border border-gray-700/50"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${gradient}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trend >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {trend >= 0 ? <ArrowUpDown className="w-3 h-3 rotate-45" /> : <ArrowUpDown className="w-3 h-3 -rotate-45" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      
      <div className="flex items-end gap-3">
        <div>
          <div className="text-3xl font-bold text-white">
            {value !== undefined ? value.toFixed(config.unit === '小时' || metricType === 'bmi' ? 1 : 0) : '--'}
          </div>
          <div className="text-sm text-gray-400">{config.label}</div>
        </div>
        
        {target && (
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke="#374151"
                strokeWidth="6"
                fill="none"
              />
              <motion.circle
                cx="32"
                cy="32"
                r={radius}
                stroke={color}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-300">{progress.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
      
      {target && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">目标</span>
            <span className="text-gray-300">{target} {config.unit}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 65;
  const offset = circumference - (score / 100) * circumference;
  
  const getScoreColor = () => {
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };
  
  const getScoreLabel = () => {
    if (score >= 80) return "优秀";
    if (score >= 60) return "良好";
    return "需关注";
  };
  
  return (
    <div className="relative w-40 h-40">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="80"
          cy="80"
          r="65"
          stroke="#1F2937"
          strokeWidth="12"
          fill="none"
        />
        <motion.circle
          cx="80"
          cy="80"
          r="65"
          stroke={getScoreColor()}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-4xl font-bold text-white"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className={`text-sm font-medium ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
          {getScoreLabel()}
        </span>
      </div>
    </div>
  );
}

function QuickLogModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (metricType: HealthMetricType, value: number) => void }) {
  const [selectedMetric, setSelectedMetric] = useState<HealthMetricType | null>(null);
  const [value, setValue] = useState("");

  const commonMetrics: HealthMetricType[] = ['water_intake', 'sleep_duration', 'heart_rate', 'steps', 'mood', 'weight'];

  if (!selectedMetric) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-gray-900/95 backdrop-blur-lg rounded-3xl p-6 w-full max-w-md mx-4 border border-gray-700/50 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-semibold text-white mb-6 text-center">添加记录</h3>
          <div className="grid grid-cols-3 gap-3">
            {commonMetrics.map((metric) => {
              const config = HEALTH_METRIC_CONFIG[metric];
              const colors: Record<string, string> = {
                water_intake: 'bg-blue-500/20 text-blue-400',
                sleep_duration: 'bg-purple-500/20 text-purple-400',
                heart_rate: 'bg-red-500/20 text-red-400',
                steps: 'bg-orange-500/20 text-orange-400',
                mood: 'bg-pink-500/20 text-pink-400',
                weight: 'bg-green-500/20 text-green-400',
              };
              return (
                <motion.button
                  key={metric}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedMetric(metric)}
                  className={`${colors[metric] || 'bg-gray-700/50'} rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:scale-105`}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-xs font-medium">{config.label}</span>
                </motion.button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="mt-6 w-full py-3 text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
        </motion.div>
      </div>
    );
  }

  const config = HEALTH_METRIC_CONFIG[selectedMetric];

  const handleSubmit = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onSubmit(selectedMetric, numValue);
      onClose();
    } else {
      showToast({ message: "请输入有效的数值", type: "error", duration: 2000 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gray-900/95 backdrop-blur-lg rounded-3xl p-6 w-full max-w-md mx-4 border border-gray-700/50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-white mb-2 text-center">{config.icon} {config.label}</h3>
        <p className="text-sm text-gray-400 mb-6 text-center">记录您的{config.label}</p>
        
        <div className="relative">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="w-full px-6 py-5 text-3xl font-bold text-center bg-gray-800/50 rounded-2xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-white"
            autoFocus
          />
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xl text-gray-500">{config.unit}</span>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
          >
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function HistorySection() {
  const [stats, setStats] = useState<{ totalRecords: number; dateRange: { start: string; end: string } | null; metricCounts: Record<string, number> }>({ totalRecords: 0, dateRange: null, metricCounts: {} });
  const [groupedRecords, setGroupedRecords] = useState<Record<string, HealthRecord[]>>({});
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const statsData = await getHealthRecordsStats();
      setStats(statsData);
      const groupedData = await getHealthRecordsGroupedByDate();
      setGroupedRecords(groupedData);
    };
    fetchData();
  }, []);

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  if (stats.totalRecords === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-8 border border-gray-700/50 text-center">
        <Database className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-xl font-semibold text-white mb-2">暂无数据</h3>
        <p className="text-gray-400">导入数据或添加记录后，历史数据将在这里显示</p>
      </div>
    );
  }

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));
  const displayDates = sortedDates.slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-5 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-indigo-500/20">
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">数据统计</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-800/50 rounded-xl">
            <div className="text-2xl font-bold text-indigo-400">{stats.totalRecords}</div>
            <div className="text-xs text-gray-400 mt-1">总记录数</div>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-xl">
            <div className="text-lg font-bold text-green-400">{stats.dateRange?.start || '--'}</div>
            <div className="text-xs text-gray-400 mt-1">最早记录</div>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-xl">
            <div className="text-lg font-bold text-blue-400">{stats.dateRange?.end || '--'}</div>
            <div className="text-xs text-gray-400 mt-1">最近记录</div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-5 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-purple-500/20">
            <History className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">历史记录</h3>
            <p className="text-xs text-gray-400">最近30天</p>
          </div>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {displayDates.map((date) => {
            const records = groupedRecords[date];
            const isExpanded = expandedDates.has(date);
            
            return (
              <motion.div
                key={date}
                className="border border-gray-700/50 rounded-xl overflow-hidden"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-white">{date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{records.length} 条</span>
                    <motion.span
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      className="text-gray-400"
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.span>
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-2">
                        {records.map((record) => {
                          const config = HEALTH_METRIC_CONFIG[record.metricType];
                          if (!config) return null;
                          return (
                            <div key={record.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span>{config.icon}</span>
                                <span className="text-sm text-gray-300">{config.label}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium text-white">
                                  {record.value.toFixed(config.unit === '小时' ? 1 : 0)} {record.unit}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                  {record.source === 'imported' ? '导入' : '手动'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-5 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">数据类型分布</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats.metricCounts).map(([metric, count]) => {
            const config = HEALTH_METRIC_CONFIG[metric as HealthMetricType];
            if (!config) return null;
            return (
              <div key={metric} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
                <span>{config.icon}</span>
                <span className="text-sm text-gray-300">{config.label}</span>
                <span className="text-sm font-medium text-indigo-400 ml-auto">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricsSection({ todayRecords }: { todayRecords: Record<string, number | undefined> }) {
  const metrics: { metricType: HealthMetricType; icon: React.ReactNode; color: string; gradient: string; target: number }[] = [
    { metricType: 'water_intake', icon: <Droplets className="w-5 h-5" />, color: '#3B82F6', gradient: 'bg-blue-500/20', target: 2000 },
    { metricType: 'sleep_duration', icon: <Moon className="w-5 h-5" />, color: '#8B5CF6', gradient: 'bg-purple-500/20', target: 8 },
    { metricType: 'heart_rate', icon: <Activity className="w-5 h-5" />, color: '#EF4444', gradient: 'bg-red-500/20', target: 100 },
    { metricType: 'steps', icon: <Target className="w-5 h-5" />, color: '#F97316', gradient: 'bg-orange-500/20', target: 10000 },
    { metricType: 'mood', icon: <Smile className="w-5 h-5" />, color: '#EC4899', gradient: 'bg-pink-500/20', target: 8 },
    { metricType: 'weight', icon: <Leaf className="w-5 h-5" />, color: '#10B981', gradient: 'bg-green-500/20', target: 70 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.metricType}
          metricType={metric.metricType}
          value={todayRecords[metric.metricType]}
          target={metric.target}
          icon={metric.icon}
          color={metric.color}
          gradient={metric.gradient}
        />
      ))}
    </div>
  );
}

function ImportSection({ onDataImport }: { onDataImport: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xml'))) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    try {
      const text = await file.text();
      let healthRecords: Omit<HealthRecord, "id" | "createdAt">[] = [];
      
      if (file.name.endsWith('.xml')) {
        healthRecords = parseXMLData(text);
      } else {
        healthRecords = parseCSVData(text);
      }
      
      if (healthRecords.length > 0) {
        await bulkAddHealthRecords(healthRecords);
        showToast({ message: `成功导入 ${healthRecords.length} 条健康数据`, type: "success", duration: 3000 });
        setFile(null);
        onDataImport();
      } else {
        showToast({ message: "未找到可导入的数据", type: "warning", duration: 2000 });
      }
    } catch (err) {
      console.error('Import error:', err);
      showToast({ message: "导入失败，请检查文件格式", type: "error", duration: 2000 });
    }
  };
  
  const parseCSVData = (text: string): Omit<HealthRecord, "id" | "createdAt">[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const healthRecords: Omit<HealthRecord, "id" | "createdAt">[] = [];
    
    const typeIndex = headers.indexOf('Type');
    const unitIndex = headers.indexOf('Unit');
    const valueIndex = headers.indexOf('Value');
    const dateIndex = headers.indexOf('Date') !== -1 ? headers.indexOf('Date') : headers.indexOf('Start Date');
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      const type = values[typeIndex]?.trim();
      const unit = values[unitIndex]?.trim();
      const valueStr = values[valueIndex]?.trim();
      const dateStr = values[dateIndex]?.trim();
      
      if (!type || !valueStr || !dateStr) continue;
      
      const metricType = mapAppleHealthTypeToMetric(type);
      if (!metricType) continue;
      
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;
      
      let normalizedValue = value;
      let normalizedUnit = unit;
      
      if (metricType === 'water_intake' && unit === 'fl oz') {
        normalizedValue = value * 29.5735;
        normalizedUnit = 'ml';
      } else if (metricType === 'distance' && unit === 'mi') {
        normalizedValue = value * 1.60934;
        normalizedUnit = 'km';
      }
      
      const dateObj = new Date(dateStr);
      const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      healthRecords.push({
        metricType,
        value: normalizedValue,
        unit: normalizedUnit,
        date: formattedDate,
        timestamp: dateObj.getTime(),
        source: 'imported',
      });
    }
    
    return healthRecords;
  };
  
  const parseXMLData = (xmlText: string): Omit<HealthRecord, "id" | "createdAt">[] => {
    const healthRecords: Omit<HealthRecord, "id" | "createdAt">[] = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const observations = xmlDoc.getElementsByTagName("observation");
    
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      
      const textEl = obs.getElementsByTagName("text")[0];
      if (!textEl) continue;
      
      const typeEl = textEl.getElementsByTagName("type")[0];
      const valueEl = textEl.getElementsByTagName("value")[0];
      const unitEl = textEl.getElementsByTagName("unit")[0];
      const lowTimeEl = obs.getElementsByTagName("low")[0];
      
      if (!typeEl || !valueEl || !lowTimeEl) continue;
      
      const type = typeEl.textContent || '';
      const valueStr = valueEl.textContent || '';
      const unit = unitEl?.textContent || '';
      const dateStr = lowTimeEl.getAttribute('value') || '';
      
      if (!type || !valueStr || !dateStr) continue;
      
      const metricType = mapAppleHealthTypeToMetric(type);
      if (!metricType) continue;
      
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;
      
      const dateObj = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6'));
      if (isNaN(dateObj.getTime())) continue;
      
      const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      healthRecords.push({
        metricType,
        value,
        unit,
        date: formattedDate,
        timestamp: dateObj.getTime(),
        source: 'imported',
      });
    }
    
    return healthRecords;
  };
  
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && line[i - 1] !== '\\') {
        inQuotes = !inQuotes;
        continue;
      }
      
      if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }
      
      current += char;
    }
    result.push(current);
    
    return result;
  };
  
  const mapAppleHealthTypeToMetric = (appleType: string): HealthMetricType | null => {
    const mapping: Record<string, HealthMetricType> = {
      'Water': 'water_intake',
      'HKQuantityTypeIdentifierDietaryWater': 'water_intake',
      'Sleep Analysis': 'sleep_duration',
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep_duration',
      'Heart Rate': 'heart_rate',
      'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
      'Step Count': 'steps',
      'HKQuantityTypeIdentifierStepCount': 'steps',
      'Distance Walking/Running': 'distance',
      'HKQuantityTypeIdentifierDistanceWalkingRunning': 'distance',
      'Flights Climbed': 'flights_climbed',
      'HKQuantityTypeIdentifierFlightsClimbed': 'flights_climbed',
      'Active Energy Burned': 'active_energy',
      'HKQuantityTypeIdentifierActiveEnergyBurned': 'active_energy',
      'Basal Energy Burned': 'basal_energy',
      'HKQuantityTypeIdentifierBasalEnergyBurned': 'basal_energy',
      'Apple Stand Time': 'standing_time',
      'HKQuantityTypeIdentifierAppleStandTime': 'standing_time',
      'Mindful Session': 'mindful_minutes',
      'HKCategoryTypeIdentifierMindfulSession': 'mindful_minutes',
      'Oxygen Saturation': 'oxygen_saturation',
      'HKQuantityTypeIdentifierOxygenSaturation': 'oxygen_saturation',
      'Respiratory Rate': 'respiratory_rate',
      'HKQuantityTypeIdentifierRespiratoryRate': 'respiratory_rate',
      'Body Temperature': 'body_temperature',
      'HKQuantityTypeIdentifierBodyTemperature': 'body_temperature',
      'Weight': 'weight',
      'HKQuantityTypeIdentifierBodyMass': 'weight',
      'Height': 'height',
      'HKQuantityTypeIdentifierHeight': 'height',
      'Blood Pressure Systolic': 'blood_pressure_systolic',
      'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure_systolic',
      'Blood Pressure Diastolic': 'blood_pressure_diastolic',
      'HKQuantityTypeIdentifierBloodPressureDiastolic': 'blood_pressure_diastolic',
      'Blood Glucose': 'blood_glucose',
      'HKQuantityTypeIdentifierBloodGlucose': 'blood_glucose',
      'BMI': 'bmi',
      'HKQuantityTypeIdentifierBodyMassIndex': 'bmi',
    };
    
    const lowerType = appleType.toLowerCase().trim();
    for (const [key, value] of Object.entries(mapping)) {
      if (key.toLowerCase() === lowerType || lowerType.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerType)) {
        return value;
      }
    }
    
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-green-500/20">
          <Upload className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">导入健康数据</h3>
          <p className="text-sm text-gray-400">从 Apple Health 导入数据</p>
        </div>
      </div>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        <input
          type="file"
          accept=".csv,.xml"
          onChange={handleFileSelect}
          className="hidden"
          id="health-import-file"
        />
        <label htmlFor="health-import-file" className="cursor-pointer">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <Upload className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-base font-medium text-white mb-1">
            拖拽文件到这里
          </p>
          <p className="text-sm text-gray-400">
            或点击选择 CSV 或 XML 文件
          </p>
        </label>
      </div>

      {file && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center justify-between p-4 bg-gray-800/50 rounded-xl"
        >
          <div>
            <p className="font-medium text-white">{file.name}</p>
            <p className="text-sm text-gray-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleImport}
            className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors"
          >
            开始导入
          </motion.button>
        </motion.div>
      )}

      <div className="mt-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
        <div className="flex items-start gap-3">
          <Star className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">提示</p>
            <p className="text-sm text-amber-200/80 mt-1">
              从 Apple Health 导出数据（支持 CSV 或 XML 格式），然后导入到这里。导入的历史数据可在"历史"标签页查看。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSection({ todayRecords, healthScore }: { todayRecords: Record<string, number | undefined>; healthScore: number }) {
  const [currentTime, setCurrentTime] = useState<string>('--');
  
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  }, []);
  
  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-lg rounded-3xl p-6 border border-indigo-500/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-pink-400" />
              <span className="text-sm text-gray-300">今日健康评分</span>
            </div>
            <p className="text-sm text-gray-400">基于今日记录的数据计算</p>
          </div>
          <HealthScoreRing score={healthScore} />
        </div>
        
        <motion.div 
          className="mt-6 flex gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex-1 bg-black/20 rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <div className="text-sm text-gray-300">数据更新于</div>
            <div className="text-xs text-gray-500">{currentTime}</div>
          </div>
          <div className="flex-1 bg-black/20 rounded-xl p-3 text-center">
            <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
            <div className="text-sm text-gray-300">今日记录</div>
            <div className="text-xs text-gray-500">{Object.values(todayRecords).filter(v => v !== undefined).length} 项</div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">今日指标</h3>
        </div>
        <MetricsSection todayRecords={todayRecords} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-5 border border-gray-700/50"
      >
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">健康建议</h3>
        </div>
        <div className="space-y-3">
          {todayRecords.water_intake !== undefined && todayRecords.water_intake < 1500 && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20"
            >
              <Droplets className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-300">多喝水</p>
                <p className="text-sm text-blue-200/70">今日饮水量不足，建议再喝 {Math.ceil((1500 - todayRecords.water_intake) / 250)} 杯水</p>
              </div>
            </motion.div>
          )}
          {todayRecords.sleep_duration !== undefined && todayRecords.sleep_duration < 7 && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20"
            >
              <Moon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-purple-300">保证睡眠</p>
                <p className="text-sm text-purple-200/70">今日睡眠不足7小时，建议早点休息</p>
              </div>
            </motion.div>
          )}
          {todayRecords.steps !== undefined && todayRecords.steps < 5000 && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20"
            >
              <Target className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-300">多运动</p>
                <p className="text-sm text-orange-200/70">今日步数较少，建议起身活动一下</p>
              </div>
            </motion.div>
          )}
          {Object.keys(todayRecords).length === 0 && (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">还没有今日记录</p>
              <p className="text-sm text-gray-500 mt-1">点击右上角按钮添加记录</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function HealthPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [todayRecords, setTodayRecords] = useState<Record<string, number | undefined>>({});
  const [healthScore, setHealthScore] = useState(0);
  const [showQuickLog, setShowQuickLog] = useState(false);

  const refreshData = async () => {
    const summary = await getDailyHealthSummary(
      new Date().toISOString().split('T')[0]
    );
    setTodayRecords(summary);
    const numericSummary: Record<string, number> = {};
    for (const [key, value] of Object.entries(summary)) {
      if (value !== undefined) {
        numericSummary[key] = value;
      }
    }
    const score = await calculateHealthScore(numericSummary);
    setHealthScore(score);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleQuickLog = async (metricType: HealthMetricType, value: number) => {
    const config = HEALTH_METRIC_CONFIG[metricType];
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    try {
      await addHealthRecord({
        metricType,
        value,
        unit: config.unit,
        date: dateStr,
        timestamp: Date.now(),
        source: "manual",
      });
      
      showToast({ message: `已记录 ${config.label}`, type: "success", duration: 2000 });
      
      const summary = await getDailyHealthSummary(dateStr);
      setTodayRecords(summary);
      const numericSummary: Record<string, number> = {};
      for (const [key, value] of Object.entries(summary)) {
        if (value !== undefined) {
          numericSummary[key] = value;
        }
      }
      const score = await calculateHealthScore(numericSummary);
      setHealthScore(score);
    } catch {
      showToast({ message: "记录失败", type: "error", duration: 2000 });
    }
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "仪表盘", icon: <Gauge className="w-4 h-4" /> },
    { key: "metrics", label: "指标", icon: <Target className="w-4 h-4" /> },
    { key: "history", label: "历史", icon: <History className="w-4 h-4" /> },
    { key: "import", label: "导入", icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">健康中心</h1>
            <p className="text-sm text-gray-400 mt-1">
              追踪你的健康数据，保持健康生活
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowQuickLog(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>添加记录</span>
          </motion.button>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="inline-flex gap-1 p-1 bg-gray-800/50 rounded-xl border border-gray-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DashboardSection todayRecords={todayRecords} healthScore={healthScore} />
            </motion.div>
          )}

          {activeTab === "metrics" && (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MetricsSection todayRecords={todayRecords} />
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <HistorySection />
            </motion.div>
          )}

          {activeTab === "import" && (
            <motion.div
              key="import"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ImportSection onDataImport={refreshData} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showQuickLog && (
          <QuickLogModal
            onClose={() => setShowQuickLog(false)}
            onSubmit={handleQuickLog}
          />
        )}
      </AnimatePresence>
    </div>
  );
}