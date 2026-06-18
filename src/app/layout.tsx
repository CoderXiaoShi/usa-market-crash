import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美股崩盘概率监测",
  description: "AI 驱动的美股崩盘风险实时监测平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
