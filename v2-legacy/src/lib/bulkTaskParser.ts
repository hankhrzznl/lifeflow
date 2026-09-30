/**
 * 批量导入任务解析器
 * 格式：
 * - 每行一个任务
 * - 2个空格缩进表示子任务
 * - | 分隔字段
 * - 备注:xxx、日期:yyyy-MM-dd、循环:每天/每周工作日/每周六,周日
 * - 日期范围: 日期:5/12~5/20
 * - # 或 // 开头为注释行
 */

interface ParsedTask {
  title: string;
  note?: string;
  date?: string;
  dateEnd?: string;
  recurring?: string;
  children: ParsedTask[];
}

export function parseBulkTasks(text: string): ParsedTask[] {
  const lines = text.split("\n").filter(l => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith("#") && !t.startsWith("//");
  });

  const roots: ParsedTask[] = [];
  const stack: { task: ParsedTask; depth: number }[] = [];

  for (const line of lines) {
    const depth = (line.match(/^ */)?.[0]?.length ?? 0) / 2;
    const content = line.trim();
    const { title, fields } = parseLine(content);
    const task: ParsedTask = { title, ...fields, children: [] };

    // Find parent
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(task);
    } else {
      stack[stack.length - 1].task.children.push(task);
    }
    stack.push({ task, depth });
  }

  return roots;
}

function parseLine(content: string): {
  title: string;
  fields: { note?: string; date?: string; dateEnd?: string; recurring?: string };
} {
  const parts = content.split("|").map(s => s.trim());
  const title = parts[0];

  const fields: ReturnType<typeof parseLine>["fields"] = {};

  for (let i = 1; i < parts.length; i++) {
    const f = parts[i];
    if (f.startsWith("备注:")) {
      fields.note = f.slice(3).trim();
    } else if (f.startsWith("日期:")) {
      const datePart = f.slice(3).trim();
      const rangeMatch = datePart.match(/^(.+?)~(.+)$/);
      if (rangeMatch) {
        fields.date = normalizeDate(rangeMatch[1].trim());
        fields.dateEnd = normalizeDate(rangeMatch[2].trim());
      } else {
        fields.date = normalizeDate(datePart);
      }
    } else if (f.startsWith("循环:")) {
      fields.recurring = f.slice(3).trim();
    }
  }

  return { title, fields };
}

function normalizeDate(raw: string): string {
  const now = new Date();
  const year = now.getFullYear();

  const m = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return `${year}-${String(Number(m[1])).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Single number = day of current month
  if (/^\d{1,2}$/.test(raw)) {
    return `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Number(raw)).padStart(2, "0")}`;
  }
  return raw;
}

/** Convert ParsedTask tree to flat ScheduleTask data */
export interface BulkTaskInput {
  title: string;
  goalId: string | null;
  parentTaskId?: string;
  date?: string | null;
  startDate?: string;
  endDate?: string;
  recurringDays?: number[];
  note?: string;
  category?: 'task' | 'habit' | 'chore';
  plannedTime?: number;
}

export function flattenTasks(
  tasks: ParsedTask[],
  goalId: string | null,
  parentTaskId?: string,
): BulkTaskInput[] {
  const result: BulkTaskInput[] = [];

  for (const t of tasks) {
    const recurringDays = parseRecurring(t.recurring);

    result.push({
      title: t.title,
      goalId,
      parentTaskId,
      date: t.date || null,
      startDate: t.date,
      endDate: t.dateEnd || t.date,
      recurringDays: recurringDays.length > 0 ? recurringDays : undefined,
      note: t.note,
      category: 'task',
      plannedTime: 60,
    });

    // Recurse children
    const childResults = flattenTasks(t.children, goalId, undefined);
    result.push(...childResults);
  }

  return result;
}

function parseRecurring(raw?: string): number[] {
  if (!raw) return [];
  const r = raw.replace(/每周/, "").trim();

  if (r.includes("工作日")) return [1, 2, 3, 4, 5];
  if (r.includes("周六") && r.includes("周日")) return [6, 0];
  if (r.includes("每天")) return [0, 1, 2, 3, 4, 5, 6];

  // Try parse specific days
  const dayMap: Record<string, number> = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0,
  };
  const days: number[] = [];
  for (const [ch, num] of Object.entries(dayMap)) {
    if (r.includes(ch)) days.push(num);
  }
  return days;
}
