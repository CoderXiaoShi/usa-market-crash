import { NextRequest, NextResponse } from "next/server";
import { getMonitor, updateMonitorStatus, deleteMonitor } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const monitor = getMonitor(id);
  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (body.status) {
    updateMonitorStatus(id, body.status);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteMonitor(id);
  return NextResponse.json({ ok: true });
}
