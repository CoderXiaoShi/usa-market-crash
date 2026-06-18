"use client";

import type { Factor } from "@/lib/db";

interface Props {
  factors: Factor[];
  onAddMonitor: () => void;
}

export default function FactorsPanel({ factors, onAddMonitor }: Props) {
  return (
    <div className="card p-5 flex flex-col h-full">
      <h2 className="text-[15px] font-semibold mb-4">影响因素</h2>
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {factors.length === 0 && (
          <p className="text-sm text-[var(--muted)]">暂无数据，等待 AI 首次采集...</p>
        )}
        {factors.map((f, i) => (
          <div
            key={i}
            className="flex justify-between items-start gap-3 p-2.5 rounded-lg bg-white/[0.03] text-[13px] leading-relaxed"
          >
            <span className="flex-1 min-w-0">{f.event}</span>
            <span
              className={`shrink-0 ml-2 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                f.impact > 0
                  ? "bg-red-500/15 text-red-400"
                  : "bg-green-500/15 text-green-400"
              }`}
            >
              {f.impact > 0 ? "+" : ""}{f.impact.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onAddMonitor}
        className="mt-4 w-full py-2.5 rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)] text-sm hover:border-[var(--blue)] hover:text-[var(--blue)] transition-colors cursor-pointer"
      >
        + 新增自定义监控
      </button>
    </div>
  );
}
