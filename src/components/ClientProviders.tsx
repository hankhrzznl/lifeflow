"use client";

import { AgentProvider } from "@/components/agent/AgentProvider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <AgentProvider>{children}</AgentProvider>;
}
