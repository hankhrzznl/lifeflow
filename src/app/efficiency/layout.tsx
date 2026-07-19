export default function EfficiencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className="w-full max-w-[430px] mx-auto pb-[80px]">
        {children}
      </main>
    </div>
  );
}
