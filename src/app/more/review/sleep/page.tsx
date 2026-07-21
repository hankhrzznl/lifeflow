"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, Moon, Clock } from "lucide-react";
export default function SleepReviewPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-6 pb-[100px]">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/more/review")} className="inline-flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: "var(--lifeflow-muted)" }}>
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <div className="flex items-center gap-2">
          <Moon className="w-6 h-6" style={{ color: "#8B5CF6" }} />
          <h1 className="text-[17px] font-semibold" style={{ color: "var(--lifeflow-foreground)" }}>睡眠复盘</h1>
        </div>
      </header>
      <div className="rounded-[20px] p-8 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#8B5CF615" }}>
          <Clock className="w-8 h-8" style={{ color: "#8B5CF6" }} />
        </div>
        <p className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>入睡趋势与达标率</p>
        <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>详细的睡眠趋势图表即将上线。<br />先通过 AI 助手说"帮我复盘这周"查看文字摘要吧。</p>
      </div>
    </div>
  );
}
