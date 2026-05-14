import { db } from "./db";
import type { AgentChatSession, AgentChatMessage } from "./types";

export async function saveAgentMemory(dateKey: string, summary: string): Promise<void> {
  try {
    await db.agentMemory.put({ dateKey, summary });
  } catch (err) {
    console.error("saveAgentMemory failed:", err);
    throw err;
  }
}

export async function getAgentMemory(dateKey: string): Promise<string | undefined> {
  try {
    const record = await db.agentMemory.where("dateKey").equals(dateKey).first();
    return record?.summary;
  } catch (err) {
    console.error("getAgentMemory failed:", err);
    return undefined;
  }
}

export async function deleteAgentMemory(dateKey: string): Promise<void> {
  try {
    await db.agentMemory.where("dateKey").equals(dateKey).delete();
  } catch (err) {
    console.error("deleteAgentMemory failed:", err);
  }
}

export async function saveChatSession(session: AgentChatSession): Promise<void> {
  try {
    await db.agentChats.put(session);
  } catch (err) {
    console.error("saveChatSession failed:", err);
    throw err;
  }
}

export async function loadChatHistory(sessionId: string): Promise<AgentChatSession | undefined> {
  try {
    return db.agentChats.get(sessionId);
  } catch (err) {
    console.error("loadChatHistory failed:", err);
    return undefined;
  }
}

export async function appendMessageToSession(
  sessionId: string,
  message: AgentChatMessage
): Promise<void> {
  try {
    const session = await db.agentChats.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.updatedAt = Date.now();
      await db.agentChats.put(session);
    }
  } catch (err) {
    console.error("appendMessageToSession failed:", err);
  }
}

export async function clearChatHistory(sessionId: string): Promise<void> {
  try {
    await db.agentChats.delete(sessionId);
  } catch (err) {
    console.error("clearChatHistory failed:", err);
  }
}

export async function getActiveChatSession(): Promise<AgentChatSession | undefined> {
  try {
    const sessions = await db.agentChats
      .orderBy("updatedAt")
      .reverse()
      .limit(1)
      .toArray();
    return sessions[0];
  } catch (err) {
    console.error("getActiveChatSession failed:", err);
    return undefined;
  }
}

export function createEmptySession(sessionId: string): AgentChatSession {
  return {
    id: sessionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
