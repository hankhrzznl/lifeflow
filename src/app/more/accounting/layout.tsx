"use client";

// ============================================================
// 记账子站容器
// ============================================================

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
      <main className="w-full max-w-[430px] mx-auto pb-[100px]">
        {children}
      </main>
    </div>
  );
}
