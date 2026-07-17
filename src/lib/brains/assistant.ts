/**
 * AssistantBrain — 意图解析引擎
 * 将自然语言转换为结构化操作指令
 */

export type IntentAction =
  | "create_task"
  | "create_goal"
  | "create_plan"
  | "query_status"
  | "add_record"
  | "start_review"
  | "start_focus"
  | "unknown";

export interface ParsedIntent {
  action: IntentAction;
  params: Record<string, string | number | boolean | string[]>;
  confidence: number;
  rawText: string;
}

export class AssistantBrain {
  /**
   * 解析用户的自然语言输入
   */
  parseIntent(text: string): ParsedIntent {
    // TODO: 实际逻辑 — 关键词匹配 + 实体提取
    // 1. 规则引擎：匹配"添加任务""今天做了什么""开始专注"等模式
    // 2. 实体提取：识别时间、数量、标签
    // 3. 回退到 AI 模型进行语义理解
    // 4. 返回置信度最高的意图
    return {
      action: "unknown",
      params: {},
      confidence: 0,
      rawText: text,
    };
  }
}
