"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Droplets, Moon, Activity, Smile, Gauge, TrendingUp, Upload, Calendar, Plus } from "lucide-react";
import { addHealthRecord, getTodayHealthRecords, getDailyHealthSummary, calculateHealthScore, getWeeklyHealthSummary, bulkAddHealthRecords } from "@/lib/db";
import { HealthMetricType, HEALTH_METRIC_CONFIG, HealthRecord } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

type TabType = "dashboard" | "log" | "trends" | "import";

interface HealthCardProps {
  metricType: HealthMetricType;
  value: number | undefined;
  unit: string;
  icon: string;
  color: string;
  bgColor: string;
  label: string;
  onClick?: () => void;
}

function HealthCard({ metricType, value, unit, icon, color, bgColor, label, onClick }: HealthCardProps) {
  const config = HEALTH_METRIC_CONFIG[metricType];
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${bgColor} rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl mb-1">{icon}</div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${color}`}>
            {value !== undefined ? value.toFixed(unit === '小时' ? 1 : 0) : '--'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">{unit}</div>
        </div>
      </div>
    </motion.div>
  );
}

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  
  const getScoreColor = () => {
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };
  
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="#E5E7EB"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke={getScoreColor()}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{score}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">健康分</span>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快速记录</h3>
          <div className="grid grid-cols-3 gap-3">
            {commonMetrics.map((metric) => {
              const config = HEALTH_METRIC_CONFIG[metric];
              return (
                <motion.button
                  key={metric}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedMetric(metric)}
                  className={`${config.bgColor} rounded-xl p-3 flex flex-col items-center gap-1`}
                >
                  <span className="text-xl">{config.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
                </motion.button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            取消
          </button>
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">记录{config.label}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{config.icon} {config.label} ({config.unit})</p>
        
        <div className="relative">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`输入${config.label}`}
            className="w-full px-4 py-4 text-2xl font-bold text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">{config.unit}</span>
        </div>
        
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
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
        showToast({ message: `成功导入 ${healthRecords.length} 条健康数据`, type: "success", duration: 2000 });
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Upload className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">导入健康数据</h3>
      </div>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Upload className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-base font-medium text-gray-900 dark:text-white mb-1">
            拖拽 CSV 或 XML 文件到这里
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            或点击选择文件
          </p>
        </label>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleImport}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
          >
            开始导入
          </motion.button>
        </div>
      )}

      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          💡 提示：从 Apple Health 导出数据（支持 CSV 或 XML 格式），然后导入到这里
        </p>
      </div>
    </div>
  );
}

function TrendsSection() {
  const [weeklyData, setWeeklyData] = useState<Record<string, { avg: number; total: number; count: number }>>({});

  useEffect(() => {
    const fetchData = async () => {
      const data = await getWeeklyHealthSummary();
      setWeeklyData(data);
    };
    fetchData();
  }, []);

  const displayMetrics: HealthMetricType[] = ['water_intake', 'sleep_duration', 'steps', 'heart_rate'];

  return (
    <div className="space-y-4">
      {displayMetrics.map((metric) => {
        const config = HEALTH_METRIC_CONFIG[metric];
        const data = weeklyData[metric];
        if (!data) return null;
        
        return (
          <div key={metric} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <span>{config.icon}</span>
                <span className="font-medium text-gray-900 dark:text-white">{config.label}</span>
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                本周 {data.count} 天
              </span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const height = Math.random() * 80 + 20;
                return (
                  <div
                    key={day}
                    className={`flex-1 rounded-t transition-all duration-500 ${
                      day === 6 ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-800'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-right">
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {metric === 'water_intake' ? (data.total / 1000).toFixed(1) : data.total.toFixed(0)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                {metric === 'water_intake' ? 'L' : config.unit}
              </span>
            </div>
          </div>
        );
      })}
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
    { key: "log", label: "记录", icon: <Calendar className="w-4 h-4" /> },
    { key: "trends", label: "趋势", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "import", label: "导入", icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">健康中心</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              追踪你的健康数据，保持健康生活
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowQuickLog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>快速记录</span>
          </motion.button>
        </div>
      </div>

      <div className="px-5">
        <div className="flex gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-indigo-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-4">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">今日健康评分</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">基于今日记录的数据计算</p>
                  </div>
                  <HealthScoreRing score={healthScore} />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <HealthCard
                  metricType="water_intake"
                  value={todayRecords.water_intake}
                  unit="ml"
                  icon="💧"
                  color="text-blue-600"
                  bgColor="bg-blue-50"
                  label="饮水量"
                />
                <HealthCard
                  metricType="sleep_duration"
                  value={todayRecords.sleep_duration}
                  unit="小时"
                  icon="😴"
                  color="text-purple-600"
                  bgColor="bg-purple-50"
                  label="睡眠时长"
                />
                <HealthCard
                  metricType="sleep_quality"
                  value={todayRecords.sleep_quality}
                  unit="分"
                  icon="⭐"
                  color="text-amber-600"
                  bgColor="bg-amber-50"
                  label="睡眠质量"
                />
                <HealthCard
                  metricType="heart_rate"
                  value={todayRecords.heart_rate}
                  unit="bpm"
                  icon="❤️"
                  color="text-red-600"
                  bgColor="bg-red-50"
                  label="心率"
                />
                <HealthCard
                  metricType="steps"
                  value={todayRecords.steps}
                  unit="步"
                  icon="👣"
                  color="text-orange-600"
                  bgColor="bg-orange-50"
                  label="步数"
                />
                <HealthCard
                  metricType="mood"
                  value={todayRecords.mood}
                  unit="分"
                  icon="😊"
                  color="text-violet-600"
                  bgColor="bg-violet-50"
                  label="心情"
                />
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">健康建议</h3>
                <div className="space-y-3">
                  {todayRecords.water_intake !== undefined && todayRecords.water_intake < 1500 && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <Droplets className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800 dark:text-blue-300">多喝水</p>
                        <p className="text-sm text-blue-700 dark:text-blue-400">今日饮水量不足，建议再喝一杯水</p>
                      </div>
                    </div>
                  )}
                  {todayRecords.sleep_duration !== undefined && todayRecords.sleep_duration < 7 && (
                    <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <Moon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-purple-800 dark:text-purple-300">保证睡眠</p>
                        <p className="text-sm text-purple-700 dark:text-purple-400">今日睡眠不足7小时，建议早点休息</p>
                      </div>
                    </div>
                  )}
                  {todayRecords.steps !== undefined && todayRecords.steps < 5000 && (
                    <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                      <Activity className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800 dark:text-orange-300">多运动</p>
                        <p className="text-sm text-orange-700 dark:text-orange-400">今日步数较少，建议起身活动一下</p>
                      </div>
                    </div>
                  )}
                  {Object.keys(todayRecords).length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>还没有今日记录</p>
                      <p className="text-sm">点击右上角按钮添加记录</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "log" && (
            <motion.div
              key="log"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setShowQuickLog(true); }}
                  className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">💧</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">饮水</div>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setShowQuickLog(true); }}
                  className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">😴</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">睡眠</div>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setShowQuickLog(true); }}
                  className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">❤️</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">心率</div>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setShowQuickLog(true); }}
                  className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">😊</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">心情</div>
                </motion.button>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white">今日记录</h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {Object.entries(todayRecords).filter(([, v]) => v !== undefined).length > 0 ? (
                    Object.entries(todayRecords).map(([metric, value]) => {
                      const config = HEALTH_METRIC_CONFIG[metric as HealthMetricType];
                      if (!config || value === undefined) return null;
                      return (
                        <div key={metric} className="px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{config.icon}</span>
                            <span className="text-gray-900 dark:text-white">{config.label}</span>
                          </div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {value.toFixed(config.unit === '小时' ? 1 : 0)} {config.unit}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      暂无记录
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "trends" && (
            <motion.div
              key="trends"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <TrendsSection />
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
