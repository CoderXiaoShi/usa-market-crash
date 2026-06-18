import { NextResponse } from "next/server";
import { assessMarket } from "@/lib/ai";
import { insertSnapshot } from "@/lib/db";

export async function POST() {
  try {
    const result = await assessMarket();
    if (result) {
      insertSnapshot({
        probability: result.probability,
        factorsJson: JSON.stringify(result.factors),
        summary: result.summary,
      });
      return NextResponse.json({ ok: true, probability: result.probability, factorCount: result.factors.length });
    }
    return NextResponse.json({ ok: false, error: "No result" }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
