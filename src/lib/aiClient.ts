// ==================== AI Client — 统一LLM调用工具 ====================

const AI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lifeflow_api_key") || null;
}

export function isAIAvailable(): boolean {
  return !!getApiKey() && typeof navigator !== "undefined" && navigator.onLine !== false;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function isAIEnabled(): boolean {
  const flag = typeof window !== "undefined" ? localStorage.getItem("lifeflow_ai_enabled") : null;
  return flag !== "false"; // 默认开启
}

export function getAISubFeatureEnabled(key: string): boolean {
  const flag = typeof window !== "undefined" ? localStorage.getItem(`lifeflow_ai_${key}`) : null;
  return flag !== "false"; // 默认开启
}

export async function callAI(options: AICallOptions): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未配置API Key，请在设置中配置");
  }

  if (!isOnline()) {
    throw new Error("当前处于离线状态，AI功能需要联网使用");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(AI_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt },
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2048,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`AI请求失败 (${response.status}): ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return content;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("AI请求超时，请稍后重试");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAIStructured<T>(
  options: AICallOptions & { responseSchema?: string }
): Promise<T> {
  const schemaHint = options.responseSchema 
    ? `\n请严格按照以下JSON格式返回（不要包含markdown标记，直接返回纯JSON）:\n${options.responseSchema}`
    : "";

  const systemPrompt = options.systemPrompt + "\n你返回的所有内容必须是合法的JSON格式，不要包含任何markdown代码块标记。" + schemaHint;
  
  const raw = await callAI({
    ...options,
    systemPrompt,
    temperature: 0.3,
  });

  // 清理可能的markdown标记
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 尝试提取JSON
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error("AI返回格式异常，无法解析为JSON");
  }
}
