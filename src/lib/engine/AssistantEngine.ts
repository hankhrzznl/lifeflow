/**
 * 助手引擎 —— 自然语言意图识别
 * 关键词匹配 + 正则槽位提取 + 模板填充
 */

type IntentType =
  | "create_goal"
  | "modify_goal"
  | "batch_adjust"
  | "query_status"
  | "checkin_yesterday"
  | "pause_goal"
  | "resume_goal"
  | "unknown";

export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  slots: Record<string, string | number>;
  original: string;
  response: string;
}

interface IntentRule {
  type: IntentType;
  keywords: string[];
  exclude?: string[];
  slotPatterns: Array<{ slot: string; regex: RegExp; default?: string | number }>;
  response: string;
}

const RULES: IntentRule[] = [
  {
    type: "create_goal",
    keywords: ["想", "要", "准备", "打算", "计划", "开始", "创建", "建一个"],
    exclude: ["改", "修改", "删", "暂停", "恢复"],
    slotPatterns: [
      { slot: "title", regex: /(?:考|学|练|减|存|读|写|跑|做|完成|通过)([^，。！\d]+)/ },
      { slot: "deadline", regex: /(\d+)个?(月|周|天)后/, default: "3个月后" },
      { slot: "category", regex: /(考研|雅思|托福|PMP|考试|备考)/, default: "exam" },
      { slot: "category", regex: /(跑步|健身|减肥|运动|瑜伽|游泳)/, default: "fitness" },
      { slot: "category", regex: /(存款|存钱|储蓄|记账|理财)/, default: "savings" },
      { slot: "category", regex: /(习惯|每天|早起|阅读|背单词|喝水)/, default: "habit" },
      { slot: "dailyHours", regex: /每天(\d+)[个]?小时/, default: 2 },
    ],
    response: "好的，小织帮你创建「{title}」目标，分类是{category}。要现在拆解吗？",
  },
  {
    type: "checkin_yesterday",
    keywords: ["昨天", "忘了", "忘记", "补", "漏了"],
    exclude: ["前天"],
    slotPatterns: [],
    response: "没问题，小织打开昨天的打卡页面给你~",
  },
  {
    type: "query_status",
    keywords: ["查", "显示", "看看", "多少", "进度", "情况", "状态"],
    slotPatterns: [{ slot: "filter", regex: /(滞后|落后|完成|进行中|暂停|全部)/, default: "全部" }],
    response: "小织帮你看看{filter}的目标状态~",
  },
  {
    type: "pause_goal",
    keywords: ["暂停", "停下", "休息", "停一下"],
    slotPatterns: [{ slot: "title", regex: /(?:暂停|停下)(.+?)[吧。！]/, default: "所有" }],
    response: "好的，小织暂停「{title}」相关的任务。要暂停多久？",
  },
  {
    type: "resume_goal",
    keywords: ["恢复", "继续", "重新开始", "启动"],
    slotPatterns: [{ slot: "title", regex: /(?:恢复|继续)(.+?)[吧。！]/, default: "之前暂停的" }],
    response: "好的，小织恢复「{title}」目标。",
  },
  {
    type: "batch_adjust",
    keywords: ["推迟", "延后", "提前", "整体", "全部", "批量"],
    slotPatterns: [
      { slot: "direction", regex: /(推迟|延后|提前|延长|缩短)/, default: "推迟" },
      { slot: "amount", regex: /(\d+)[个]?(天|周|月)/, default: 7 },
    ],
    response: "小织帮你把目标整体{direction}{amount}天。确定吗？",
  },
  {
    type: "modify_goal",
    keywords: ["改", "修改", "调整", "换成", "变成"],
    slotPatterns: [
      { slot: "title", regex: /「(.+?)」/ },
      { slot: "field", regex: /(截止|日期|时间|名字|标题|优先级)/, default: "deadline" },
      { slot: "newValue", regex: /改[为成到](.+?)[吧。！]/ },
    ],
    response: "好的，小织把「{title}」的{field}改成{newValue}。",
  },
];

export class AssistantEngine {
  parse(input: string): ParsedIntent {
    const normalized = input.toLowerCase().trim();
    let best: ParsedIntent | null = null;
    let bestScore = 0;

    for (const rule of RULES) {
      const score = this.score(normalized, rule);
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        const slots = this.extract(normalized, rule);
        best = {
          type: rule.type,
          confidence: Math.round(score * 100),
          slots,
          original: input,
          response: this.fill(rule.response, slots),
        };
      }
    }

    return (
      best || {
        type: "unknown",
        confidence: 0,
        slots: {},
        original: input,
        response: "小织没听懂呢，你可以说「我想3个月后考雅思」或者「帮我创建跑步计划」~",
      }
    );
  }

  getSuggestions(context: { hasGoals: boolean; todayProgress: number; streakDays: number }): string[] {
    const s: string[] = [];
    if (!context.hasGoals) {
      s.push("我想3个月后考研");
      s.push("帮我制定减肥计划");
      s.push("我想养成早起的习惯");
    } else {
      if (context.todayProgress < 50) s.push("显示今天的任务");
      if (context.streakDays > 0) s.push(`已连续${context.streakDays}天，继续保持！`);
      s.push("我上周的复盘");
      s.push("显示滞后的目标");
    }
    return s.slice(0, 3);
  }

  private score(input: string, rule: IntentRule): number {
    let s = 0;
    for (const k of rule.keywords) if (input.includes(k)) s += 0.3;
    if (rule.exclude) for (const e of rule.exclude) if (input.includes(e)) s -= 0.5;
    let m = 0;
    for (const p of rule.slotPatterns) if (p.regex.test(input)) m++;
    if (rule.slotPatterns.length > 0) s += (m / rule.slotPatterns.length) * 0.3;
    return Math.min(s, 1);
  }

  private extract(input: string, rule: IntentRule): Record<string, string | number> {
    const s: Record<string, string | number> = {};
    for (const p of rule.slotPatterns) {
      const m = input.match(p.regex);
      if (m) s[p.slot] = m[1] || m[0];
      else if (p.default !== undefined) s[p.slot] = p.default;
    }
    return s;
  }

  private fill(tpl: string, slots: Record<string, string | number>): string {
    return tpl.replace(/\{(\w+)\}/g, (_, k) =>
      slots[k] !== undefined ? String(slots[k]) : _
    );
  }

  parseDeadline(input: string): string {
    const m = input.match(/(\d+)个?月/);
    if (m) {
      const d = new Date();
      d.setMonth(d.getMonth() + parseInt(m[1]));
      return d.toISOString().split("T")[0];
    }
    const d2 = new Date();
    d2.setMonth(d2.getMonth() + 3);
    return d2.toISOString().split("T")[0];
  }
}

export const assistantEngine = new AssistantEngine();
