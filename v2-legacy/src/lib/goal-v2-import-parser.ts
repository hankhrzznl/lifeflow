/**
 * GoalV2 导入解析器 — 解析 AI 生成的 JSON 模板
 */

// ============================================================
// 导入数据结构
// ============================================================

export interface ImportedGoal {
  title: string;
  vision?: string;
  color?: string;
  keyResults: ImportedKeyResult[];
  strategies: ImportedStrategy[];
}

export interface ImportedKeyResult {
  description: string;
  targetValue: number;
  unit: string;
  deadline?: string;
}

export interface ImportedStrategy {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  cycleType: 'daily' | 'weekly';
  /** 每日固定模式的多个时段 */
  dailyActions: { title: string; time: string; duration: number }[];
  /** 每周各天的周任务标题 */
  weeklyTasks: { title: string; deliverable: string }[];
  /** 按周循环模式的每日配置 */
  weeklyPattern?: Record<number, { title: string; time: string; duration: number; enabled: boolean }>;
}

// ============================================================
// AI 提示词 — 五层拆解法创建指引
// ============================================================

export const GOAL_V2_AI_PROMPT = `# 目标五层拆解法 — AI 创建指引

## 什么是目标五层拆解法？

目标五层拆解法是一种将抽象目标层层分解为可执行计划的方法。它将目标拆解为五个层次：

1. **L1 愿景** — 目标达成时的具体画面、感受和成果
2. **L2 关键结果** — 可量化的衡量指标（如：体脂率降至22%、四级考试425分）
3. **L3 策略** — 实现关键结果的能力线/方法论（如：饮食控制、力量训练）
4. **L4 周任务** — 每条策略下按周规划的具体任务和交付成果
5. **L5 日行动** — 每日具体要执行的最小行动单元（含时间、时长）

## 你的任务

用户将告诉你他想实现的目标。请你根据目标五层拆解法，为这个目标生成一份完整的、可直接导入的计划。

## 输出格式要求

请**严格**按以下 JSON 格式输出，不要包含任何额外说明文字：

\`\`\`json
{
  "title": "目标名称（简洁有力，如：6个月练出马甲线）",
  "vision": "愿景画面描述（50-100字，描述目标实现时的具体画面）",
  "color": "#6366F1",
  "keyResults": [
    {
      "description": "关键结果描述（可量化的指标）",
      "targetValue": 数值,
      "unit": "单位（% / kg / 分 / 次 等）",
      "deadline": "YYYY-MM-DD格式的截止日期"
    }
  ],
  "strategies": [
    {
      "name": "策略名称",
      "description": "策略描述（如何实现该策略的方法论）",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "cycleType": "daily 或 weekly",
      "dailyActions": [
        { "title": "行动内容描述", "time": "HH:MM（必填）", "duration": 时长分钟数（必填） }
      ],
      "weeklyTasks": [
        { "title": "本周任务标题", "deliverable": "本周交付成果描述" }
      ]
    }
  ]
}
\`\`\`

## 字段说明

- **title**（必填）：目标名称，简洁有力
- **vision**（推荐）：50-100字，描述目标实现时的画面
- **color**（可选）：十六进制颜色代码，默认 #6366F1
- **keyResults**（必填，1-3条）：每条关键结果必须有 description、targetValue、unit
- **strategies**（必填，1-4条）：每条策略必须包含：
  - **name**: 策略名称
  - **startDate/endDate**: 该策略的起止日期（用于分阶段执行）
  - **cycleType**: "daily" 表示每天固定执行，"weekly" 表示按周循环
  - **dailyActions**: 当 cycleType 为 "daily" 时必填，列出每天要执行的具体行动。支持多个时段（如早读、主学、复盘各一条）。每条 dailyAction 的 **time（必填）** 为 HH:MM 格式，**duration（必填）** 为分钟数
  - **weeklyTasks**: 该策略下每周要完成的任务（至少1条），作为周任务模板
  - **weeklyPattern（weekly 必填）**: 当 cycleType 为 "weekly" 时**必须提供**此字段。键名为英文星期名（monday/tuesday/wednesday/thursday/friday/saturday/sunday），示例：
    "weeklyPattern": {
      "monday": { "title": "背诵1篇真题范文，拆解结构并抄写亮点句型" },
      "tuesday": { "title": "模仿范文结构，掐时间写1篇同类型作文" },
      "wednesday": { "title": "完成1套翻译真题，对比答案修改，积累3个固定表达" },
      "thursday": { "title": "回译练习：将周三的参考译文回译成英文，再与原文对比" },
      "friday": { "title": "整理本周写译好词好句到本子上，口头复述一遍" },
      "saturday": { "title": "限时模考1套完整的写作+翻译，找老师或AI批改" }
    }

## 重要规则

1. 关键结果必须有明确的量化目标值
2. 策略的起止日期决定了该阶段的时间跨度
3. 每个策略至少有一条 dailyAction 和一个 weeklyTask
4. dailyActions 支持多条（多条时段表示每天在该策略下执行多件事）
5. 所有日期格式必须为 YYYY-MM-DD
6. 直接在代码块中输出 JSON，不要包含额外说明

现在，请为用户的目标生成上述 JSON 格式的计划。`;

// ============================================================
// 解析器
// ============================================================

/**
 * 从 AI 返回的文本中提取 JSON 并解析为 ImportedGoal
 * 支持从 markdown 代码块中提取 JSON
 */
export function parseImportedGoal(text: string): ImportedGoal {
  // 尝试从 ```json ... ``` 代码块中提取
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  const parsed = JSON.parse(jsonStr);

  // 验证必要字段
  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('缺少必要字段：title（目标名称）');
  }
  if (!Array.isArray(parsed.keyResults) || parsed.keyResults.length === 0) {
    throw new Error('缺少关键结果（keyResults）');
  }
  if (!Array.isArray(parsed.strategies) || parsed.strategies.length === 0) {
    throw new Error('缺少策略（strategies）');
  }

  // 验证并规范化关键结果
  const keyResults: ImportedKeyResult[] = parsed.keyResults.map((kr: any, i: number) => {
    if (!kr.description) {
      throw new Error(`第 ${i + 1} 条关键结果缺少 description`);
    }
    return {
      description: kr.description,
      targetValue: typeof kr.targetValue === 'number' ? kr.targetValue : 0,
      unit: kr.unit || '次',
      deadline: kr.deadline || '',
    };
  });

  // 验证并规范化策略
  const strategies: ImportedStrategy[] = parsed.strategies.map((s: any, i: number) => {
    if (!s.name) {
      throw new Error(`第 ${i + 1} 条策略缺少 name`);
    }

    // 规范化 dailyActions
    let dailyActions: { title: string; time: string; duration: number }[] = [];
    if (Array.isArray(s.dailyActions)) {
      dailyActions = s.dailyActions.map((a: any) => ({
        title: a.title || '',
        time: a.time || '08:00',
        duration: typeof a.duration === 'number' ? a.duration : 30,
      }));
    }
    // 如果 cycleType 是 daily 但没有 dailyActions，尝试从旧格式提取
    if (dailyActions.length === 0 && s.dailyActionTitle) {
      dailyActions.push({
        title: s.dailyActionTitle,
        time: s.dailyActionTime || '08:00',
        duration: s.dailyActionDuration || 30,
      });
    }

    // 规范化 weeklyTasks
    let weeklyTasks: { title: string; deliverable: string }[] = [];
    if (Array.isArray(s.weeklyTasks)) {
      weeklyTasks = s.weeklyTasks.map((wt: any) => ({
        title: wt.title || '',
        deliverable: wt.deliverable || '',
      }));
    }
    // 兼容旧格式
    if (weeklyTasks.length === 0 && s.weeklyTaskTitle) {
      weeklyTasks.push({
        title: s.weeklyTaskTitle,
        deliverable: s.weeklyTaskDeliverable || '',
      });
    }

    // 确保至少有一条周任务
    if (weeklyTasks.length === 0) {
      weeklyTasks.push({ title: `${s.name} - 本周任务`, deliverable: '' });
    }

    // 归一化 weeklyPattern：把 "monday"/"sunday"/0/1 等统一为数字索引 0-6
    let weeklyPattern: Record<string, { title: string; time?: string; duration?: number }> | undefined;
    const DAY_NAME_MAP: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    if (s.weeklyPattern) {
      weeklyPattern = {};
      for (const [key, val] of Object.entries(s.weeklyPattern as Record<string, any>)) {
        const idx = DAY_NAME_MAP[key.toLowerCase()] ?? Number(key);
        if (!isNaN(idx) && idx >= 0 && idx <= 6) {
          weeklyPattern[String(idx)] = val;
        }
      }
    }

    return {
      name: s.name,
      description: s.description || '',
      startDate: s.startDate || '',
      endDate: s.endDate || '',
      cycleType: s.cycleType === 'weekly' ? 'weekly' : 'daily',
      dailyActions,
      weeklyTasks,
      weeklyPattern,
    };
  });

  return {
    title: parsed.title.trim(),
    vision: parsed.vision || '',
    color: parsed.color || '#6366F1',
    keyResults,
    strategies,
  };
}

/**
 * 验证导入数据是否完整可用
 */
export function validateImportedGoal(data: ImportedGoal): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title) errors.push('目标名称不能为空');
  if (data.keyResults.length === 0) errors.push('至少需要一个关键结果');
  if (data.strategies.length === 0) errors.push('至少需要一个策略');

  for (let i = 0; i < data.keyResults.length; i++) {
    const kr = data.keyResults[i];
    if (!kr.description) errors.push(`第 ${i + 1} 条关键结果缺少描述`);
    if (kr.targetValue <= 0) errors.push(`第 ${i + 1} 条关键结果的目标值必须大于 0`);
  }

  for (let i = 0; i < data.strategies.length; i++) {
    const s = data.strategies[i];
    if (!s.name) errors.push(`第 ${i + 1} 条策略缺少名称`);
    if (s.dailyActions.length === 0 && !s.weeklyPattern) {
      errors.push(`策略「${s.name}」缺少每日行动配置`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// T25：一键导入「目标 + 理想日模板」双结构（V2 提示词）
// ============================================================

/** 导入的理想日模板结构（AI 输出契约） */
export interface ImportedIdealDayTemplate {
  name: string;
  daysOfWeek?: number[];            // 周索引（0=周一）可空
  sleepBedTime?: string;            // HH:MM，默认 22:30
  sleepWakeTime?: string;           // HH:MM，默认 06:00
  blocks: {
    id: string;                     // 槽位 id（目标 dailyActions 挂靠）
    label: string;
    start: string;
    end: string;
    group: string;                  // sleep/morning/noon/afternoon/evening
    features: string[];             // 功能白名单
  }[];
}

/** AI 输出双结构根对象 */
export interface ImportedGoalV2Bundle {
  goal: ImportedGoal;
  idealDayTemplate?: ImportedIdealDayTemplate;
}

/**
 * T25：V2 提示词 — 一次生成「五层目标 + 理想日模板」
 * 目标 dailyActions 挂靠 blockId（时间由模板分配，禁止自由写 time → 物理防冲突）
 */
export const GOAL_V2_AI_PROMPT_V2 = `# 目标五层拆解法 + 理想日模板 — AI 创建指引

## 你的任务

用户将告诉你他想实现的目标。请基于「8+8+8 理想日架构」（睡眠 8h / 工作学习 8h / 生活 8h）生成一份完整导入包：
**一份五层目标（goal）+ 一份理想日模板（idealDayTemplate）**。

## 8+8+8 三分类

目标分为三类，对应一天中的三个 8 小时时段：
- **sleep** 睡眠（8h 恢复精力）
- **workStudy** 工作学习（8h 目标推进）
- **life** 生活（8h 留给自己）

功能也归属三类：
- 睡眠类：sleep
- 工作学习类：study / focus / routine / medication
- 生活类：leisure / water / diet / posture / wellness / workout / notes

## 挂靠规则（核心）

每个目标可挂靠 0~多个功能（attachedFeatures），挂靠后该目标的行动在日程上显示功能图标；
不挂靠则显示目标图标。目标行动（dailyActions）**必须挂靠 idealDayTemplate 中的 blockId**，
由模板分配时段，禁止自行填写 time —— 这样目标与理想日物理上不可能冲突。

## 输出格式

请**严格**按以下 JSON 输出，不要包含任何额外说明文字：

\`\`\`json
{
  "goal": {
    "title": "目标名称",
    "vision": "愿景画面描述（50-100字）",
    "color": "#6366F1",
    "goalCategory": "workStudy（sleep / workStudy / life 三选一）",
    "attachedFeatures": ["study", "focus"],
    "keyResults": [
      { "description": "可量化指标", "targetValue": 数值, "unit": "单位", "deadline": "YYYY-MM-DD" }
    ],
    "strategies": [
      {
        "name": "策略名称",
        "description": "策略描述",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "cycleType": "daily 或 weekly",
        "dailyActions": [
          { "title": "行动内容", "blockId": "block-study-morning（从 idealDayTemplate.blocks 中选）", "duration": 时长分钟数 }
        ],
        "weeklyTasks": [
          { "title": "本周任务标题", "deliverable": "本周交付成果" }
        ]
      }
    ]
  },
  "idealDayTemplate": {
    "name": "工作日模板",
    "sleepBedTime": "22:30",
    "sleepWakeTime": "06:00",
    "blocks": [
      { "id": "block-sleep", "label": "睡眠", "start": "22:30", "end": "06:30", "group": "sleep", "features": ["sleep"] },
      { "id": "block-morning", "label": "上午学习", "start": "08:00", "end": "12:00", "group": "morning", "features": ["study", "focus"] },
      { "id": "block-noon", "label": "午间生活", "start": "12:00", "end": "14:00", "group": "noon", "features": ["water", "diet", "leisure"] },
      { "id": "block-afternoon", "label": "下午学习", "start": "14:00", "end": "18:00", "group": "afternoon", "features": ["study", "focus"] },
      { "id": "block-evening", "label": "晚间生活", "start": "19:00", "end": "22:00", "group": "evening", "features": ["workout", "posture", "wellness", "leisure"] }
    ]
  }
}
\`\`\`

## 重要规则

1. dailyActions 的 **blockId 必须来自 idealDayTemplate.blocks 的 id**，且该 block 的 features 白名单
   必须包含该行动挂靠的功能（如 blockId=block-morning 只放 study/focus 类行动）；**禁止把非 sleep
   行动挂到 sleep 段**（睡眠段物理排除）
2. dailyActions 不填写 time，时间由模板块边界决定；duration 为行动时长（分钟）
3. 目标行动合计时长应大致匹配对应 8h 配额（工作学习类目标 8h 内、生活类 8h 内）
4. attachedFeatures 为空数组时表示目标不挂靠功能（日程显示目标图标）
5. 睡眠时间可调：sleepBedTime/sleepWakeTime 按用户作息填写（默认 22:30 / 06:00）
6. 所有日期格式必须为 YYYY-MM-DD，时间为 HH:MM
7. 直接在代码块中输出 JSON，不要包含额外说明文字

现在，请为用户的目标生成上述 JSON 格式的完整导入包。`;

/**
 * T25：解析 AI 返回的双结构导入包
 * 兼容：仅目标（旧格式）→ goal 顶层；双结构 → { goal, idealDayTemplate }
 */
export function parseImportedGoalV2(text: string): ImportedGoalV2Bundle {
  // 剥壳容错：去除 ```json 代码块标记
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  const parsed = JSON.parse(jsonStr);

  // 双结构：{ goal: {...}, idealDayTemplate: {...} }
  if (parsed.goal && typeof parsed.goal === 'object') {
    const goal = parseImportedGoal(JSON.stringify(parsed.goal));
    const idealDayTemplate = parsed.idealDayTemplate
      ? parseImportedIdealDayTemplate(JSON.stringify(parsed.idealDayTemplate))
      : undefined;
    return { goal, idealDayTemplate };
  }
  // 兼容旧格式：顶层即目标
  return { goal: parseImportedGoal(text), idealDayTemplate: undefined };
}

/** 解析并校验理想日模板 */
export function parseImportedIdealDayTemplate(text: string): ImportedIdealDayTemplate {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  const parsed = JSON.parse(jsonStr);

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('缺少必要字段：name（模板名称）');
  }
  if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    throw new Error('缺少模板块（blocks）');
  }

  const blocks: { id: string; label: string; start: string; end: string; group: string; features: string[] }[] = parsed.blocks.map((b: Record<string, unknown>, i: number) => {
    if (!b.id || !b.label || !b.start || !b.end) {
      throw new Error(`第 ${i + 1} 个模板块缺少 id/label/start/end`);
    }
    if (!/^\d{2}:\d{2}$/.test(String(b.start)) || !/^\d{2}:\d{2}$/.test(String(b.end))) {
      throw new Error(`第 ${i + 1} 个模板块时间格式错误（需 HH:MM）`);
    }
    return {
      id: String(b.id),
      label: String(b.label),
      start: String(b.start),
      end: String(b.end),
      group: String(b.group || 'morning'),
      features: Array.isArray(b.features) ? b.features.map((f: unknown) => String(f)) : [],
    };
  });

  // 睡眠段约束：含 sleep 功能的块必须只有 sleep
  for (const b of blocks) {
    if (b.features.includes('sleep') && b.features.some((f) => f !== 'sleep')) {
      throw new Error(`模板块「${b.label}」睡眠段不能包含非 sleep 功能`);
    }
  }

  return {
    name: parsed.name.trim(),
    daysOfWeek: Array.isArray(parsed.daysOfWeek) ? parsed.daysOfWeek : undefined,
    sleepBedTime: /^\d{2}:\d{2}$/.test(parsed.sleepBedTime || '') ? parsed.sleepBedTime : '22:30',
    sleepWakeTime: /^\d{2}:\d{2}$/.test(parsed.sleepWakeTime || '') ? parsed.sleepWakeTime : '06:00',
    blocks,
  };
}

/** 校验导入包（目标 + 模板），返回分块错误 */
export function validateImportedGoalV2(data: ImportedGoalV2Bundle): {
  goalValid: boolean;
  goalErrors: string[];
  templateValid: boolean;
  templateErrors: string[];
} {
  const gv = validateImportedGoal(data.goal);

  // 模板校验
  const templateErrors: string[] = [];
  let templateValid = true;
  const tpl = data.idealDayTemplate;
  if (tpl) {
    const groups = ['sleep', 'morning', 'noon', 'afternoon', 'evening'];
    const hasSleep = tpl.blocks.some((b) => b.group === 'sleep' || b.features.includes('sleep'));
    if (!hasSleep) templateErrors.push('模板缺少睡眠段');
    const blockIds = new Set(tpl.blocks.map((b) => b.id));
    // 校验 dailyActions 的 blockId 挂靠
    for (const s of data.goal.strategies) {
      for (const da of s.dailyActions) {
        const bid = (da as unknown as { blockId?: string }).blockId;
        if (bid && !blockIds.has(bid)) {
          templateErrors.push(`行动「${da.title}」挂靠的 blockId「${bid}」不存在于模板`);
        }
      }
    }
    if (templateErrors.length > 0) templateValid = false;
    void groups;
  }

  return {
    goalValid: gv.valid,
    goalErrors: gv.errors,
    templateValid,
    templateErrors,
  };
}
