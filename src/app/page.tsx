import { getLatestSnapshot, getAllSettings } from "@/lib/db";
import { getLastRunTime } from "@/lib/scheduler";
import type { Factor } from "@/lib/db";
import ProbabilityGauge from "@/components/ProbabilityGauge";
import ChatPanel from "@/components/ChatPanel";
import SettingsBar from "@/components/SettingsBar";
import ClientShell from "@/components/ClientShell";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const snapshot = getLatestSnapshot();
  const settings = getAllSettings();
  const lastRunTime = getLastRunTime();

  const probability = snapshot?.probability ?? 0;
  const factors: Factor[] = snapshot?.factors_json
    ? JSON.parse(snapshot.factors_json)
    : [];
  const summary = snapshot?.summary ?? "";
  const frequency = settings.search_frequency || "10";

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6">
      <div className="flex justify-between items-center mb-1 pb-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-semibold">美股崩盘概率监测</h1>
      </div>

      <div className="mt-4">
        <SettingsBar frequency={frequency} lastRunTime={lastRunTime} />
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6 mb-6 max-md:grid-cols-1">
        <div className="card p-8 flex flex-col items-center">
          <ProbabilityGauge probability={probability} />
          {summary ? (
            <div className="mt-5 p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-sm leading-relaxed text-[#d4d4d8] w-full">
              <strong className="text-red-400">AI 综合评述：</strong>
              {summary}
            </div>
          ) : (
            <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-[var(--border)] text-sm text-[var(--muted)] text-center w-full">
              等待 AI 首次采集数据，检查 .env 中 LLM_API_KEY 是否已配置
            </div>
          )}
        </div>

        <ClientShell factors={factors} />
      </div>

      <ChatPanel />
    </div>
  );
}
