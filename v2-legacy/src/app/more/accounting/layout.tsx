import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "记账",
};

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
