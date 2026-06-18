"use server";

import { createMonitor } from "@/lib/db";
import { parseMonitorDescription } from "@/lib/ai";
import { revalidatePath } from "next/cache";

export async function addMonitor(formData: FormData) {
  const userInput = formData.get("userInput") as string;
  if (!userInput || userInput.trim().length === 0) {
    return { error: "请输入监控描述" };
  }

  const parsed = await parseMonitorDescription(userInput);
  if (!parsed) {
    return { error: "AI 解析失败，请重试" };
  }

  createMonitor({ name: parsed.name, searchPrompt: userInput });
  revalidatePath("/");
  return { success: true, name: parsed.name };
}
