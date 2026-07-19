"use client";
import { showToast } from "@/components/ui/Toast";
export default function StubPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <p className="text-[34px] mb-3">🚧</p>
        <p className="text-[17px] font-semibold mb-2">功能开发中</p>
        <p className="text-[15px]" style={{ color: "#8E8E93" }}>即将上线</p>
      </div>
    </div>
  );
}
