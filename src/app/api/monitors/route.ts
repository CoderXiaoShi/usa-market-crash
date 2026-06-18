import { NextRequest, NextResponse } from "next/server";
import { listMonitors, createMonitor } from "@/lib/db";
import { parseMonitorDescription } from "@/lib/ai";

export async function GET() {
  const monitors = listMonitors();
  return NextResponse.json(monitors);
}

export async function POST(req: NextRequest) {
  const { userInput } = await req.json();

  const parsed = await parseMonitorDescription(userInput);
  if (!parsed) {
    return NextResponse.json({ error: "AI 解析失败" }, { status: 500 });
  }

  const monitor = createMonitor({
    name: parsed.name,
    searchPrompt: userInput,
  });

  return NextResponse.json(monitor, { status: 201 });
}
