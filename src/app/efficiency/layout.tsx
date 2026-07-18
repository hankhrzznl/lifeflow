export default function EfficiencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className="w-full max-w-[430px] mx-auto" style={{ paddingBottom: "var(--bottom-nav-height)" }}>
        {children}
      </main>
    </div>
  );
}
