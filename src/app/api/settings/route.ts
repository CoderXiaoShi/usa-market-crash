import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  for (const key of Object.keys(body)) {
    setSetting(key, String(body[key]));
  }
  const { restartScheduler } = await import("@/lib/scheduler");
  restartScheduler();
  return NextResponse.json({ ok: true });
}
