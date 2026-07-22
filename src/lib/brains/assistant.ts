/**
 * AssistantBrain — 意图解析引擎
 * 将自然语言转换为结构化操作指令
 * 纯本地规则引擎：关键词匹配 + 模式识别 + 实体提取
 */

// ─── Intent Types ────────────────────────────────────────────

export type IntentAction =
  | "create_goal" | "query_goal" | "update_goal"
  | "add_transaction" | "query_finance"
  | "record_water" | "query_water"
  | "record_sleep" | "query_sleep"
  | "record_workout" | "query_workout"
  | "record_stretch" | "query_stretch"
  | "create_reminder" | "query_reminder"
  | "create_schedule" | "query_schedule"
  | "query_review" | "navigate_review"
  | "record_habit" | "query_habit"
  | "start_focus" | "query_focus"
  | "record_medication"
  | "create_note" | "query_note"
  | "create_countdown" | "query_countdown"
  | "query_courses" | "query_routines"
  | "create_project" | "query_project"
  | "record_diet" | "query_diet"
  | "record_wellness" | "query_wellness"
  | "undo"
  | "unknown";

export interface ParsedIntent {
  action: IntentAction;
  params: Record<string, string | number | boolean | string[]>;
  confidence: number;
  rawText: string;
}

// ─── Entity Types ────────────────────────────────────────────

export interface ExtractedEntities {
  amount?: number;
  date?: string;
  time?: string;
  datetime?: number;
  category?: string;
  exerciseName?: string;
  postureIssue?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  volume?: number;
  unit?: string;
  goalTitle?: string;
  goalType?: 'longterm' | 'shortterm' | 'daily' | 'habit';
  frequency?: string;
  frequencyCount?: number;
  period?: 'daily' | 'weekly' | 'monthly';
  deadline?: string;
  reminderType?: string;
  reminderTime?: string;
  reminderRecurrence?: string;
  dateRange?: { start: string; end: string };
  projectName?: string;
  noteContent?: string;
  habitName?: string;
  focusMinutes?: number;
  medicationName?: string;
  countdownName?: string;
  countdownDate?: string;
  mealType?: string;
  name?: string;
  type?: string;
}

// ─── Keyword Patterns ────────────────────────────────────────

interface IntentPattern {
  action: IntentAction;
  keywords: string[];
  priority: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // P1: Goals
  { action: "create_goal", keywords: ["创建目标", "新目标", "添加目标", "我要", "我想", "制定"], priority: 10 },
  { action: "query_goal", keywords: ["目标进度", "目标完成", "目标怎么样", "目标如何"], priority: 10 },
  { action: "update_goal", keywords: ["更新目标", "修改目标", "调整目标", "删除目标", "删掉目标", "移除目标"], priority: 10 },

  // P1: Finance
  { action: "add_transaction", keywords: ["花了", "消费", "买了", "付了", "支出了", "收入", "赚了", "进账", "入账"], priority: 9 },
  { action: "query_finance", keywords: ["花了多少", "收入多少", "账单", "花费", "支出", "财务统计", "收支", "结余"], priority: 9 },

  // P1: Sleep
  { action: "record_sleep", keywords: ["睡觉", "入睡", "就寝", "睡了", "上床", "晚安"], priority: 9 },
  { action: "query_sleep", keywords: ["睡眠", "睡了几小时", "早睡", "入睡时间", "睡眠记录", "睡眠统计"], priority: 9 },

  // P1: Reminders
  { action: "create_reminder", keywords: ["提醒我", "记得", "别忘了", "别忘", "帮我提醒"], priority: 9 },
  { action: "query_reminder", keywords: ["有什么提醒", "待处理提醒", "提醒列表", "还有什么提醒"], priority: 9 },

  // P2: Water
  { action: "record_water", keywords: ["喝水", "饮水", "喝了", "补水", "一杯水"], priority: 8 },
  { action: "query_water", keywords: ["喝了多少水", "饮水记录", "饮水统计"], priority: 8 },

  // P2: Workout
  { action: "record_workout", keywords: ["健身", "训练", "练了", "卧推", "深蹲", "硬拉", "推举", "弯举", "划船", "引体"], priority: 8 },
  { action: "query_workout", keywords: ["训练记录", "健身记录", "练了几次", "个人最佳", "PB"], priority: 8 },

  // P2: Schedule
  { action: "create_schedule", keywords: ["日程", "安排", "排到", "加入日程", "添加到日历", "几点到几点"], priority: 8 },
  { action: "query_schedule", keywords: ["今天的日程", "明天有什么", "日程安排", "今天有什么", "查看日程"], priority: 8 },

  // P2: Review
  { action: "query_review", keywords: ["复盘", "回顾", "总结", "本周总结", "月度总结"], priority: 8 },
  { action: "navigate_review", keywords: ["可视化复盘", "查看图表", "打开复盘"], priority: 8 },

  // P2: Projects
  { action: "create_project", keywords: ["创建项目", "新建项目", "添加项目"], priority: 8 },
  { action: "query_project", keywords: ["项目进度", "项目列表", "项目怎么样"], priority: 8 },

  // P3: Stretch
  { action: "record_stretch", keywords: ["拉伸", "体态", "放松", "猫式", "下犬式"], priority: 7 },

  // P3: Habits
  { action: "record_habit", keywords: ["打卡", "习惯打卡", "完成了"], priority: 7 },
  { action: "query_habit", keywords: ["习惯记录", "打卡记录", "连续天数"], priority: 7 },

  // P3: Focus
  { action: "start_focus", keywords: ["专注", "番茄钟", "开始专注", "专注模式", "开始番茄"], priority: 7 },
  { action: "query_focus", keywords: ["专注记录", "专注了多久", "专注统计"], priority: 7 },

  // P3: Medication
  { action: "record_medication", keywords: ["吃药", "用药", "服药", "维生素", "药片"], priority: 7 },

  // P3: Notes
  { action: "create_note", keywords: ["记一下", "备忘录", "笔记", "记个", "记录一下"], priority: 7 },
  { action: "query_note", keywords: ["查看笔记", "备忘录里", "笔记列表"], priority: 7 },

  // P3: Countdown
  { action: "create_countdown", keywords: ["倒数日", "倒计时", "还有几天"], priority: 7 },
  { action: "query_countdown", keywords: ["倒数日列表", "倒计时列表"], priority: 7 },

  // P3: Courses / Routines
  { action: "query_courses", keywords: ["课程表", "今天什么课", "课程安排"], priority: 7 },
  { action: "query_routines", keywords: ["作息", "作息时间", "日常安排"], priority: 7 },

  // P3: Diet
  { action: "record_diet", keywords: ["吃", "饮食", "吃了", "早餐", "午餐", "晚餐", "加餐", "食物"], priority: 8 },

  // P3: Wellness
  { action: "record_wellness", keywords: ["功法", "养生", "提肛", "八段锦", "太极", "五禽戏"], priority: 8 },

  // P2: Undo
  { action: "undo", keywords: ["撤回", "撤销", "撤消", "undo", "取消上次", "回滚"], priority: 9 },
];

// ─── Category Patterns ──────────────────────────────────────

const EXPENSE_CATEGORIES: Record<string, string> = {
  "餐饮": "food", "吃饭": "food", "午餐": "food", "晚餐": "food", "早餐": "food", "外卖": "food", "聚餐": "food",
  "交通": "transport", "打车": "transport", "地铁": "transport", "公交": "transport", "加油": "transport",
  "购物": "shopping", "买": "shopping",
  "娱乐": "entertainment", "电影": "entertainment", "游戏": "entertainment",
  "住房": "housing", "房租": "housing", "房贷": "housing",
  "医疗": "medical", "看病": "medical", "药": "medical",
  "学习": "education", "书": "education", "课程": "education",
  "通讯": "communication", "话费": "communication",
  "日用": "daily",
  "社交": "social", "礼物": "social",
  "宠物": "pet",
};

const INCOME_CATEGORIES: Record<string, string> = {
  "薪资": "salary", "工资": "salary", "薪水": "salary",
  "兼职": "parttime", "副业": "parttime",
  "投资": "investment", "理财": "investment", "股票": "investment",
  "礼金": "gift",
  "退款": "refund",
};

// ─── Numeric Entity Extraction ───────────────────────────────

const AMOUNT_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*(?:块|元|¥|￥|块钱|块钱)/,
  /(?:花了?|消费|买了?|付了?|收入|赚了?)\s*(\d+(?:\.\d+)?)/,
  /(\d+(?:\.\d+)?)\s*元?钱?\s*(?:的)?/,
];

const SET_REP_PATTERNS = [
  /(\d+)\s*[组xX×]\s*(\d+)\s*(?:次|个|下)/,
  /(\d+)\s*组\s*(\d+)\s*(?:次|个|下)/,
  /(\d+)\s*[xX×]\s*(\d+)/,
];

const WEIGHT_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)/i,
  /(\d+(?:\.\d+)?)\s*(?:lb|磅)/i,
];

const VOLUME_PATTERNS = [
  /(\d+)\s*(?:ml|毫升|升|l)/i,
  /(\d+)\s*(?:杯|口|下)/,
];

const TIME_PATTERNS = [
  /(?:今天|明天|后天)?\s*(?:上午|下午|晚上|早上|中午)?\s*(\d{1,2})[:：点](\d{0,2})?(?:分)?/,
  /(?:今天|明天|后天)?\s*(?:上午|下午|晚上|早上|中午)?\s*(\d{1,2})点半/,
];

const FREQUENCY_PATTERNS = [
  /每天/, /每周/, /每月/, /每日/,
  /(\d+)\s*[次天]\s*(?:一[天周月])?/,
  /周([一二三四五六日天])/,
  /每周\s*(\d+)\s*次/,
];

const DATE_RANGE_PATTERNS: Record<string, { start: string; end: string }> = {
  "今天": { start: "today", end: "today" },
  "昨天": { start: "yesterday", end: "yesterday" },
  "这周": { start: "this_week", end: "this_week" },
  "本周": { start: "this_week", end: "this_week" },
  "上周": { start: "last_week", end: "last_week" },
  "这个月": { start: "this_month", end: "this_month" },
  "本月": { start: "this_month", end: "this_month" },
  "上月": { start: "last_month", end: "last_month" },
  "最近7天": { start: "7d", end: "today" },
  "最近30天": { start: "30d", end: "today" },
};

// ─── AssistantBrain Class ────────────────────────────────────

export class AssistantBrain {
  /**
   * 解析用户的自然语言输入，返回最匹配的意图和提取的实体
   */
  parseIntent(text: string): ParsedIntent {
    if (!text || !text.trim()) {
      return { action: "unknown", params: {}, confidence: 0, rawText: text };
    }

    const trimmed = text.trim();
    const lowerText = trimmed.toLowerCase();

    // Step 1: Match intent via keyword patterns
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;
      for (const kw of pattern.keywords) {
        if (lowerText.includes(kw)) {
          score += pattern.priority;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    // Step 2: Legacy patterns from old assistant (backward compat)
    if (!bestMatch && /点|到|下午|上午|明天|后天|晚上|早上/.test(trimmed)) {
      return {
        action: "create_schedule",
        params: {},
        confidence: 0.6,
        rawText: trimmed,
      };
    }

    if (!bestMatch && /统计|专注了|进度|多久/.test(trimmed)) {
      return {
        action: "query_focus",
        params: {},
        confidence: 0.4,
        rawText: trimmed,
      };
    }

    if (!bestMatch || bestScore < 5) {
      return {
        action: "unknown",
        params: {},
        confidence: 0,
        rawText: trimmed,
      };
    }

    // Step 3: Extract entities based on intent
    const entities = this.extractEntities(trimmed, bestMatch.action);
    const confidence = Math.min(bestScore / 20, 0.95);

    return {
      action: bestMatch.action,
      params: entities as Record<string, string | number | boolean | string[]>,
      confidence,
      rawText: trimmed,
    };
  }

  /**
   * 根据意图类型提取对应的实体
   */
  private extractEntities(text: string, action: IntentAction): ExtractedEntities {
    const entities: ExtractedEntities = {};

    switch (action) {
      case "add_transaction":
        this.extractAmount(entities, text);
        this.extractFinanceCategory(entities, text);
        this.extractDate(entities, text);
        break;

      case "query_finance":
        this.extractFinanceCategory(entities, text);
        this.extractDateRange(entities, text);
        break;

      case "record_water":
        this.extractVolume(entities, text);
        break;

      case "query_water":
      case "query_sleep":
      case "query_workout":
        this.extractDateRange(entities, text);
        break;

      case "record_sleep":
        this.extractTime(entities, text);
        this.extractDate(entities, text);
        break;

      case "record_workout":
        this.extractSetsReps(entities, text);
        this.extractWeight(entities, text);
        this.extractRPE(entities, text);
        this.extractExerciseName(entities, text);
        break;

      case "record_stretch":
        this.extractSetsReps(entities, text);
        this.extractExerciseName(entities, text);
        this.extractPostureIssue(entities, text);
        break;

      case "create_goal":
        this.extractGoalTitle(entities, text);
        this.extractFrequency(entities, text);
        this.extractDeadline(entities, text);
        break;

      case "create_reminder":
        this.extractReminderDetails(entities, text);
        break;

      case "start_focus":
        this.extractFocusMinutes(entities, text);
        break;

      case "create_note":
        this.extractNoteContent(entities, text);
        break;

      case "record_medication":
        this.extractMedicationName(entities, text);
        this.extractTime(entities, text);
        break;

      case "create_countdown":
        this.extractCountdownDetails(entities, text);
        break;

      case "create_project":
        this.extractProjectName(entities, text);
        break;

      case "create_schedule":
        this.extractDate(entities, text);
        this.extractTime(entities, text);
        break;

      case "query_review":
        this.extractDateRange(entities, text);
        break;

      case "record_habit":
        this.extractHabitName(entities, text);
        break;

      case "record_diet":
        this.extractDietDetails(entities, text);
        break;

      case "record_wellness":
        this.extractWellnessDetails(entities, text);
        break;
    }

    return entities;
  }

  // ─── Individual Extractors ───────────────────────────────

  private extractAmount(entities: ExtractedEntities, text: string): void {
    for (const pattern of AMOUNT_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        entities.amount = parseFloat(match[1]);
        return;
      }
    }
    // Fallback: just find any number
    const numMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      entities.amount = parseFloat(numMatch[1]);
    }
  }

  private extractFinanceCategory(entities: ExtractedEntities, text: string): void {
    for (const [keyword, key] of Object.entries(EXPENSE_CATEGORIES)) {
      if (text.includes(keyword)) {
        entities.category = key;
        return;
      }
    }
    for (const [keyword, key] of Object.entries(INCOME_CATEGORIES)) {
      if (text.includes(keyword)) {
        entities.category = key;
        return;
      }
    }
  }

  private extractSetsReps(entities: ExtractedEntities, text: string): void {
    for (const pattern of SET_REP_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        entities.sets = parseInt(match[1]);
        entities.reps = parseInt(match[2]);
        return;
      }
    }
  }

  private extractWeight(entities: ExtractedEntities, text: string): void {
    for (const pattern of WEIGHT_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        entities.weight = parseFloat(match[1]);
        return;
      }
    }
  }

  private extractVolume(entities: ExtractedEntities, text: string): void {
    for (const pattern of VOLUME_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        entities.volume = parseInt(match[1]);
        entities.unit = text.includes("ml") || text.includes("毫升") ? "ml" : "count";
        return;
      }
    }
    // Default 200ml
    const numMatch = text.match(/(\d+)/);
    if (numMatch) {
      entities.volume = parseInt(numMatch[1]);
      entities.unit = "ml";
    }
  }

  private extractRPE(entities: ExtractedEntities, text: string): void {
    const match = text.match(/[Rr][Pp][Ee]\s*(\d{1,2})/);
    if (match) {
      entities.rpe = parseInt(match[1]);
    }
  }

  private extractExerciseName(entities: ExtractedEntities, text: string): void {
    const commonExercises = [
      "卧推", "深蹲", "硬拉", "推举", "弯举", "划船", "引体向上",
      "飞鸟", "弯举", "臂屈伸", "提踵", "卷腹", "平板支撑",
      "猫式拉伸", "下犬式", "儿童式", "眼镜蛇式", "蝴蝶拉伸",
      "肩部拉伸", "颈部放松", "腰部拉伸", "全身流动",
    ];
    for (const ex of commonExercises) {
      if (text.includes(ex)) {
        entities.exerciseName = ex;
        return;
      }
    }
  }

  private extractPostureIssue(entities: ExtractedEntities, text: string): void {
    const postureIssues = [
      "驼背", "圆肩", "骨盆前倾", "头部前倾", "脊柱侧弯",
    ];
    for (const issue of postureIssues) {
      if (text.includes(issue)) {
        entities.postureIssue = issue;
        return;
      }
    }
  }

  private extractTime(entities: ExtractedEntities, text: string): void {
    for (const pattern of TIME_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const hour = parseInt(match[1]);
        const min = match[2] ? parseInt(match[2]) : 0;
        entities.time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        return;
      }
    }
  }

  private extractDate(entities: ExtractedEntities, text: string): void {
    const now = new Date();
    if (text.includes("明天")) {
      now.setDate(now.getDate() + 1);
    } else if (text.includes("后天")) {
      now.setDate(now.getDate() + 2);
    } else if (text.includes("昨天")) {
      now.setDate(now.getDate() - 1);
    }
    entities.date = this.formatDate(now);
  }

  private extractDateRange(entities: ExtractedEntities, text: string): void {
    for (const [keyword, range] of Object.entries(DATE_RANGE_PATTERNS)) {
      if (text.includes(keyword)) {
        entities.dateRange = this.resolveDateRange(range);
        return;
      }
    }
    // Default: this week
    entities.dateRange = this.resolveDateRange(DATE_RANGE_PATTERNS["这周"]);
  }

  private resolveDateRange(range: { start: string; end: string }): { start: string; end: string } {
    const now = new Date();
    let start: Date, end: Date;

    if (range.start === "today") {
      start = new Date(now);
      end = new Date(now);
    } else if (range.start === "yesterday") {
      start = new Date(now); start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (range.start === "this_week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday start
      start = new Date(now); start.setDate(now.getDate() - diff);
      end = new Date(now);
    } else if (range.start === "last_week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      end = new Date(now); end.setDate(now.getDate() - diff - 1);
      start = new Date(end); start.setDate(end.getDate() - 6);
    } else if (range.start === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
    } else if (range.start === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (range.start === "7d") {
      start = new Date(now); start.setDate(start.getDate() - 7);
      end = new Date(now);
    } else if (range.start === "30d") {
      start = new Date(now); start.setDate(start.getDate() - 30);
      end = new Date(now);
    } else {
      start = new Date(now); start.setDate(start.getDate() - 7);
      end = new Date(now);
    }

    return {
      start: this.formatDate(start),
      end: this.formatDate(end),
    };
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private extractGoalTitle(entities: ExtractedEntities, text: string): void {
    // Remove command prefix words
    let title = text
      .replace(/创建目标|新目标|添加目标|我要|我想|帮我|制定/g, "")
      .replace(/一个|个/g, "")
      .trim();
    if (title) entities.goalTitle = title;
  }

  private extractFrequency(entities: ExtractedEntities, text: string): void {
    if (text.includes("每天") || text.includes("每日")) {
      entities.period = "daily";
      entities.frequencyCount = 1;
    } else if (text.includes("每周")) {
      entities.period = "weekly";
      const match = text.match(/每周\s*(\d+)\s*次/);
      entities.frequencyCount = match ? parseInt(match[1]) : 1;
    } else if (text.includes("每月")) {
      entities.period = "monthly";
      const match = text.match(/每月\s*(\d+)\s*次/);
      entities.frequencyCount = match ? parseInt(match[1]) : 1;
    }
  }

  private extractDeadline(entities: ExtractedEntities, text: string): void {
    const patterns = [
      /(\d+)月内/, /(\d+)个月内/, /(\d+)天后/, /(\d+)周内/,
      /截止\s*(\d+)月/, /截止日期\s*(\d+)/,
      /到\s*(\d+)月(\d+)日/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        entities.deadline = m[0];
        return;
      }
    }
  }

  private extractReminderDetails(entities: ExtractedEntities, text: string): void {
    // Extract type
    if (text.includes("喝水") || text.includes("饮水")) entities.reminderType = "water";
    else if (text.includes("睡觉") || text.includes("睡眠") || text.includes("入睡")) entities.reminderType = "sleep";
    else if (text.includes("吃药") || text.includes("用药")) entities.reminderType = "medication";
    else if (text.includes("健身") || text.includes("训练")) entities.reminderType = "fitness";
    else if (text.includes("打卡")) entities.reminderType = "habit";
    else entities.reminderType = "task";

    // Extract time
    this.extractTime(entities, text);

    // Extract recurrence
    if (text.includes("每天")) entities.reminderRecurrence = "daily";
    else if (text.includes("每周")) entities.reminderRecurrence = "weekly";
    else if (text.includes("每月")) entities.reminderRecurrence = "monthly";
    else entities.reminderRecurrence = "once";
  }

  private extractFocusMinutes(entities: ExtractedEntities, text: string): void {
    const match = text.match(/(\d+)\s*(?:分钟|分|min)/i);
    if (match) {
      entities.focusMinutes = parseInt(match[1]);
    } else {
      entities.focusMinutes = 25; // Default Pomodoro
    }
  }

  private extractNoteContent(entities: ExtractedEntities, text: string): void {
    const content = text
      .replace(/记一下|备忘录|笔记|记个|记录一下/g, "")
      .trim();
    if (content) entities.noteContent = content;
  }

  private extractMedicationName(entities: ExtractedEntities, text: string): void {
    const meds = ["维生素", "钙片", "鱼油", "感冒药", "止痛药", "创可贴", "药膏"];
    for (const med of meds) {
      if (text.includes(med)) {
        entities.medicationName = med;
        return;
      }
    }
    // Try to extract after "吃了"
    const match = text.match(/吃了?\s*(\S+)/);
    if (match) entities.medicationName = match[1];
  }

  private extractCountdownDetails(entities: ExtractedEntities, text: string): void {
    // Remove prefix
    const cleaned = text.replace(/倒数日|倒计时|还有几天|创建/g, "").trim();

    // Try date match
    const dateMatch = cleaned.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
    if (dateMatch) {
      entities.countdownDate = `${dateMatch[1]}-${String(parseInt(dateMatch[2])).padStart(2, "0")}-${String(parseInt(dateMatch[3])).padStart(2, "0")}`;
      entities.countdownName = cleaned.replace(dateMatch[0], "").trim();
      return;
    }
    entities.countdownName = cleaned;
  }

  private extractProjectName(entities: ExtractedEntities, text: string): void {
    const cleaned = text
      .replace(/创建项目|新建项目|添加项目/g, "")
      .trim();
    if (cleaned) entities.projectName = cleaned;
  }

  private extractHabitName(entities: ExtractedEntities, text: string): void {
    const cleaned = text
      .replace(/打卡|习惯打卡|完成了/g, "")
      .trim();
    if (cleaned) entities.habitName = cleaned;
  }

  private extractDietDetails(entities: ExtractedEntities, text: string): void {
    // Extract meal type
    if (text.includes("早餐")) entities.mealType = "breakfast";
    else if (text.includes("午餐")) entities.mealType = "lunch";
    else if (text.includes("晚餐")) entities.mealType = "dinner";
    else if (text.includes("加餐")) entities.mealType = "snack";
    else entities.mealType = "snack";

    // Extract food name
    let name = text
      .replace(/吃了|吃|饮食|早餐|午餐|晚餐|加餐|食物/g, "")
      .trim();
    if (name) {
      entities.name = name;
    }
  }

  private extractWellnessDetails(entities: ExtractedEntities, text: string): void {
    // Extract type
    if (text.includes("提肛")) {
      entities.type = "tigang";
    } else {
      entities.type = "gongfa";
    }

    // Extract name
    let name = text
      .replace(/功法|养生|提肛|八段锦|太极|五禽戏/g, "")
      .trim();
    if (name) {
      entities.name = name;
    }
  }

  /**
   * 获取帮助信息 — 当无法识别意图时返回
   */
  getHelpMessage(): string {
    return `你可以试试这样说：
• "午餐花了30块" — 记账
• "喝了200ml水" — 记录饮水
• "卧推3组10次40kg" — 记录训练
• "昨晚11点睡的" — 记录睡眠
• "提醒我每天9点喝水" — 设置提醒
• "帮我创建一个跑步目标，每周3次" — 创建目标
• "这周餐饮花了多少" — 查询账单
• "帮我复盘这周" — 生成复盘
• "今天喝了多少水" — 查询饮水
• "开始25分钟专注" — 开始番茄钟
• "早餐吃了鸡蛋" — 记录饮食
• "做了八段锦" — 记录养生
• "撤回" — 撤销上次操作`;
  }
}

// ─── Singleton Export ────────────────────────────────────────

export const assistantBrain = new AssistantBrain();
