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
        { "title": "行动内容描述", "time": "HH:MM", "duration": 时长分钟数 }
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
  - **dailyActions**: 当 cycleType 为 "daily" 时，列出每天要执行的具体行动。支持多个时段（如早读、主学、复盘各一条）
  - **weeklyTasks**: 该策略下每周要完成的任务（至少1条），作为周任务模板
  - **weeklyPattern**: 当 cycleType 为 "weekly" 时使用，按星期几配置不同任务

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
