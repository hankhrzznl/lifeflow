"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WidgetToday, WidgetGoals, WidgetHabits } from "./WidgetComponents";

function WidgetContent() {
  const params = useSearchParams();
  const type = params.get("type") || "today";

  return (
    <div className="min-h-screen bg-transparent p-3">
      {type === "today" && <WidgetToday />}
      {type === "goals" && <WidgetGoals />}
      {type === "habits" && <WidgetHabits />}
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" /></div>}>
      <WidgetContent />
    </Suspense>
  );
}
