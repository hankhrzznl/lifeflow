"use client";

import { useEffect } from "react";
import { initializeEfficiencyDB } from "@/lib/db/efficiency.db";

export default function EfficiencyLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeEfficiencyDB();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className="w-full max-w-[430px] mx-auto pb-[80px]">
        {children}
      </main>
    </div>
  );
}
