"use client";

import { useState, useEffect } from "react";

export function TypingIndicator({ delayMs = 500 }: { delayMs?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <div className="flex items-start gap-2 px-1">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L9.7 8.5L3 9.7L8.3 14.7L7 21L12 17.5L17 21L15.7 14.7L21 9.7L14.3 8.5L12 2Z" fill="white" />
        </svg>
      </div>
      <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-zinc-400"
            style={{
              animation: `bounce 1.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite`,
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function typingIndicatorStyles(): string {
  return `
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1; }
}
`;
}
