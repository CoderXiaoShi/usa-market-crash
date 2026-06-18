"use client";

import { useState } from "react";
import { addMonitor } from "@/app/actions";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MonitorDialog({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("userInput", text);

    const result = await addMonitor(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setText("");
      onClose();
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card p-6 w-[480px] max-w-[90vw]">
        <h3 className="text-base font-semibold mb-4">新增自定义监控</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="用自然语言告诉AI你要监控什么，搜到以后如何影响美股崩盘概率...

例如：关注英伟达股价是否出现单日跌幅超过10%，如果出现说明AI泡沫可能破裂，大幅增加崩盘概率"
          className="w-full h-[120px] px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] resize-y outline-none focus:border-[var(--blue)]"
          style={{ fontFamily: "inherit" }}
        />
        <p className="text-xs text-[var(--muted)] mt-2 mb-4">
          AI 将自动解析你的描述，提取搜索关键词和影响逻辑，定时执行监控。
        </p>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--muted)] text-sm cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--blue)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            {loading ? "解析中..." : "创建监控"}
          </button>
        </div>
      </div>
    </div>
  );
}
