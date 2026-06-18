import { NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/db";

export async function GET() {
  const snapshot = getLatestSnapshot();
  if (!snapshot) {
    return NextResponse.json({ probability: 0, factors: [], summary: "", createdAt: null });
  }
  return NextResponse.json({
    probability: snapshot.probability,
    factors: JSON.parse(snapshot.factors_json),
    summary: snapshot.summary,
    createdAt: snapshot.created_at,
  });
}
