import { NextRequest, NextResponse } from "next/server";
import { getLatestSnapshot, updateSnapshotFactors } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const snapshot = getLatestSnapshot();
  if (!snapshot) {
    return NextResponse.json({ error: "No snapshot found" }, { status: 404 });
  }

  const { factors } = await req.json();
  if (!Array.isArray(factors)) {
    return NextResponse.json({ error: "factors array required" }, { status: 400 });
  }

  // Validate factor shape
  for (const f of factors) {
    if (!f.event || typeof f.impact !== "number" || !f.description) {
      return NextResponse.json({ error: "Each factor needs event, impact, description" }, { status: 400 });
    }
  }

  const result = updateSnapshotFactors(snapshot.id, factors);
  return NextResponse.json({ ok: true, probability: result.probability, factors: result.factors });
}
