/**
 * LLMBridge — 可选增强层
 * 当本地规则引擎信心不足时，调用外部 LLM 进行语义理解
 */

export interface LLMConfig {
  provider: "openai" | "anthropic" | "custom";
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface LLMResponse {
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  explanation: string;
}

const DEFAULT_CONFIG_KEY = "lifeflow_llm_config";

export function getLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(DEFAULT_CONFIG_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as LLMConfig;
    if (!config.enabled || !config.apiKey) return null;
    return config;
  } catch {
    return null;
  }
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(config));
}

export function clearLLMConfig(): void {
  localStorage.removeItem(DEFAULT_CONFIG_KEY);
}

/**
 * 调用 LLM 进行自然语言理解
 * 发送用户输入 + 可用动作列表，期望返回结构化意图
 */
export async function callLLM(text: string, config: LLMConfig): Promise<LLMResponse | null> {
  const actionsHint = [
    "create_goal", "query_goal", "update_goal",
    "add_transaction", "query_finance",
    "record_water", "query_water",
    "record_sleep", "query_sleep",
    "record_workout", "query_workout",
    "record_stretch",
    "create_reminder", "query_reminder",
    "create_schedule", "query_schedule",
    "query_review", "navigate_review",
    "record_habit", "query_habit",
    "start_focus", "query_focus",
    "record_medication",
    "create_note", "query_note",
    "create_countdown", "query_countdown",
    "query_courses", "query_routines",
    "create_project", "query_project",
  ].join(", ");

  const systemPrompt = `你是一个个人管理助手。根据用户的自然语言输入，返回一个 JSON 对象：

{
  "action": "<从可用动作列表中选择>",
  "params": { <提取的参数键值对> },
  "confidence": <0-1之间的数字>,
  "explanation": "<一句话解释>"
}

可用动作: ${actionsHint}

提取规则：
- amount: 金额数字
- category: 分类（如 food/transport/shopping）
- exerciseName: 运动名称
- sets/reps/weight: 组数/次数/重量
- goalTitle: 目标名称
- date/timerange: 日期/时间
- 不要编造不存在的字段

只返回 JSON，不要其他文字。`;

  const url = config.provider === "openai" ? (config.baseUrl || "https://api.openai.com/v1/chat/completions")
    : config.provider === "anthropic" ? "https://api.anthropic.com/v1/messages"
    : config.baseUrl || "https://api.openai.com/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.provider === "openai" || config.provider === "custom") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  } else if (config.provider === "anthropic") {
    headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  let body: string;
  if (config.provider === "anthropic") {
    body = JSON.stringify({
      model: config.model || "claude-3-haiku-20240307",
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });
  } else {
    body = JSON.stringify({
      model: config.model || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      max_tokens: 200,
      temperature: 0,
    });
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) return null;
    const data = await res.json();

    let content: string;
    if (config.provider === "anthropic") {
      content = data.content?.[0]?.text || "";
    } else {
      content = data.choices?.[0]?.message?.content || "";
    }

    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as LLMResponse;
    return {
      action: parsed.action || "unknown",
      params: parsed.params || {},
      confidence: parsed.confidence || 0.5,
      explanation: parsed.explanation || "",
    };
  } catch {
    return null;
  }
}

export const llmBridge = { getLLMConfig, saveLLMConfig, clearLLMConfig, callLLM };
