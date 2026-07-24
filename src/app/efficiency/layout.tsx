import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "目标",
};

export default function EfficiencyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
