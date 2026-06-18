import { NextRequest, NextResponse } from "next/server";
import { getChatMessages, insertChatMessage } from "@/lib/db";

export async function GET() {
  const messages = getChatMessages();
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const { role, content } = await req.json();
  if (!role || !content) {
    return NextResponse.json({ error: "role and content required" }, { status: 400 });
  }
  const msg = insertChatMessage({ role, content });
  return NextResponse.json(msg, { status: 201 });
}
