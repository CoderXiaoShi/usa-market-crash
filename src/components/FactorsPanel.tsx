"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Factor } from "@/lib/db";

interface Props {
  factors: Factor[];
  onAddMonitor: () => void;
}

function computePct(factors: Factor[], impact: number) {
  const n = factors.length;
  if (n === 0) return 0;
  return impact * (55 / (n * 10));
}

export default function FactorsPanel({ factors, onAddMonitor }: Props) {
  const router = useRouter();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Factor>({ event: "", impact: 0, description: "" });
  const [saving, setSaving] = useState(false);

  const saveFactors = useCallback(
    async (newFactors: Factor[]) => {
      setSaving(true);
      try {
        await fetch("/api/snapshot/factors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factors: newFactors }),
        });
        router.refresh();
      } catch {
        /* best effort */
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditForm({ ...factors[idx] });
  };

  const cancelEdit = () => {
    setEditingIdx(null);
  };

  const saveEdit = async () => {
    const updated = [...factors];
    updated[editingIdx!] = {
      event: editForm.event.trim(),
      impact: Math.max(-10, Math.min(10, editForm.impact)),
      description: editForm.description.trim(),
    };
    await saveFactors(updated);
    setEditingIdx(null);
  };

  const deleteFactor = async (idx: number) => {
    const updated = factors.filter((_, i) => i !== idx);
    await saveFactors(updated);
  };

  if (factors.length === 0) {
    return (
      <div className="card p-5 flex flex-col h-full">
        <h2 className="text-[15px] font-semibold mb-4">影响因素</h2>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--muted)]">暂无数据，等待 AI 首次采集...</p>
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

  return (
    <div className="card p-5 flex flex-col h-full">
      <h2 className="text-[15px] font-semibold mb-4">影响因素</h2>
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {factors.map((f, i) => {
          const pct = computePct(factors, f.impact);
          const isPositive = pct > 0;

          if (editingIdx === i) {
            return (
              <div key={i} className="p-2.5 rounded-lg bg-white/[0.06] border border-[var(--blue)] text-[13px] space-y-2">
                <input
                  value={editForm.event}
                  onChange={(e) => setEditForm({ ...editForm, event: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-[13px] outline-none"
                  placeholder="事件描述"
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-[13px] outline-none resize-none"
                  placeholder="影响逻辑"
                />
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-[var(--muted)]">影响评分(-10~+10):</label>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    value={editForm.impact}
                    onChange={(e) => setEditForm({ ...editForm, impact: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-[13px] outline-none"
                  />
                  <span className="text-[11px] text-[var(--muted)]">
                    贡献 {editForm.impact > 0 ? "+" : ""}{(editForm.impact * (55 / (factors.length * 10))).toFixed(1)}%
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editForm.event.trim()}
                    className="px-3 py-1 rounded bg-[var(--blue)] text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)] text-xs cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="group flex justify-between items-start gap-2 p-2.5 rounded-lg bg-white/[0.03] text-[13px] leading-relaxed"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <span className="flex-1 min-w-0">{f.event}</span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                      isPositive
                        ? "bg-red-500/15 text-red-400"
                        : "bg-green-500/15 text-green-400"
                    }`}
                  >
                    {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">{f.description}</p>
              </div>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(i)}
                  className="px-1.5 py-0.5 rounded text-[11px] text-[var(--muted)] hover:text-[var(--blue)] hover:bg-white/[0.06] cursor-pointer"
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  onClick={() => deleteFactor(i)}
                  disabled={saving}
                  className="px-1.5 py-0.5 rounded text-[11px] text-[var(--muted)] hover:text-red-400 hover:bg-white/[0.06] cursor-pointer disabled:opacity-50"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
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
