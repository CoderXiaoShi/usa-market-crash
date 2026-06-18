"use client";

import { useState } from "react";

export default function SetupForm() {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openai_api_key: key }),
    });
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-..."
        className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
      />
      <button
        onClick={save}
        disabled={saving || !key.trim()}
        className="w-full py-2.5 rounded-lg bg-[var(--blue)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
      >
        {saving ? "保存中..." : "开始使用"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        API Key 仅保存在本地 SQLite 数据库中，不会上传到任何服务器
      </p>
    </div>
  );
}
