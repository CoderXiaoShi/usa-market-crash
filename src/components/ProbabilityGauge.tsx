"use client";

interface Props {
  probability: number;
}

export default function ProbabilityGauge({ probability }: Props) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - probability / 100);

  const color =
    probability >= 60 ? "var(--red)" : probability >= 30 ? "var(--orange)" : "var(--green)";

  const level =
    probability >= 60 ? "高风险区间" : probability >= 30 ? "中等风险区间" : "低风险区间";

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm text-[var(--muted)] mb-4">当前美股崩盘概率</div>
      <div className="relative w-[200px] h-[200px]">
        <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
          <circle
            cx="100" cy="100" r={radius}
            fill="none" stroke="#1e1e30" strokeWidth="14"
          />
          <circle
            cx="100" cy="100" r={radius}
            fill="none" stroke={color} strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-extrabold tracking-tight" style={{ color }}>
            {probability.toFixed(1)}
            <span className="text-3xl">%</span>
          </span>
        </div>
      </div>
      <div className="text-xs text-[var(--muted)] mt-1">{level}</div>
    </div>
  );
}
