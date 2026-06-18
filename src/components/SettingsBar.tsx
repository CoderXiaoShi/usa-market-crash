"use client";

interface Props {
  frequency: string;
  lastRunTime: string | null;
}

export default function SettingsBar({ frequency, lastRunTime }: Props) {
  const handleChange = async (val: string) => {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search_frequency: val }),
    });
  };

  const timeAgo = lastRunTime
    ? (() => {
        const diff = Date.now() - new Date(lastRunTime).getTime();
        const min = Math.floor(diff / 60000);
        return min < 1 ? "刚刚" : `${min} 分钟前`;
      })()
    : null;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[var(--green)]" />
        <span className="text-sm text-[var(--muted)]">AI 监控运行中</span>
        {timeAgo && <span className="text-sm text-[var(--muted)]">· {timeAgo} 刷新</span>}
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        AI 搜索频率：
        <select
          defaultValue={frequency}
          onChange={(e) => handleChange(e.target.value)}
          className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--text)] text-sm outline-none cursor-pointer"
        >
          <option value="5">5 分钟</option>
          <option value="10">10 分钟</option>
          <option value="30">30 分钟</option>
          <option value="60">1 小时</option>
          <option value="240">4 小时</option>
        </select>
      </div>
    </div>
  );
}
