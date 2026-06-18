import { NextRequest } from "next/server";
import { chatStream } from "@/lib/ai";
import { getLatestSnapshot } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { message, history } = await req.json();

  const snapshot = getLatestSnapshot();
  const context = snapshot
    ? `当前崩盘概率: ${snapshot.probability}%\n影响因素: ${snapshot.factors_json}\nAI评述: ${snapshot.summary}`
    : "暂无市场数据";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = chatStream(message, context, history || []);
        for await (const chunk of gen) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`\n\n[错误] ${err.message || "AI 服务暂不可用"}`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
