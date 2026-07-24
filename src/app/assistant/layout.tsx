import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "助手",
};

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
