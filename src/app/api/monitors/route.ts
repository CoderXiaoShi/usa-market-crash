import { NextRequest, NextResponse } from "next/server";
import { listMonitors, createMonitor } from "@/lib/db";
import { parseMonitorDescription } from "@/lib/ai";

export async function GET() {
  const monitors = listMonitors();
  return NextResponse.json(monitors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Direct creation: name + searchPrompt provided explicitly
  if (body.name && body.searchPrompt) {
    const monitor = createMonitor({ name: body.name, searchPrompt: body.searchPrompt });
    return NextResponse.json(monitor, { status: 201 });
  }

  // AI-assisted creation: parse user's natural language description
  const userInput = body.userInput;
  if (!userInput) {
    return NextResponse.json({ error: "需要 userInput 或 (name + searchPrompt)" }, { status: 400 });
  }

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
