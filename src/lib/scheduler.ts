import type { ScheduledTask } from "node-cron";
import cron from "node-cron";
import { assessMarket, assessMonitorEvent } from "./ai";
import { insertSnapshot, listMonitors, getSetting, insertMonitorEvent, seedDefaultMonitors } from "./db";

let cronJob: ScheduledTask | null = null;
let isRunning = false;
let lastRunTime: string | null = null;
let firstRunDone = false;

export function getLastRunTime() {
  return lastRunTime;
}

async function runMarketAssessment() {
  if (isRunning) return;
  isRunning = true;

  try {
    console.log("[Scheduler] Starting market assessment...");

    // 1. Main market assessment
    const result = await assessMarket();
    if (result) {
      insertSnapshot({
        probability: result.probability,
        factorsJson: JSON.stringify(result.factors),
        summary: result.summary,
      });
      console.log(`[Scheduler] Probability updated: ${result.probability}%`);
    }

    // 2. Run custom monitor assessments
    const monitors = listMonitors().filter((m) => m.status === "active");
    for (const monitor of monitors) {
      try {
        const event = await assessMonitorEvent(
          monitor.search_prompt,
          monitor.search_prompt,
          "根据搜索到的信息，评估该事件对美股崩盘概率的影响"
        );
        if (event) {
          insertMonitorEvent({
            monitorId: monitor.id,
            content: event.content,
            impactDesc: event.impactDesc,
            impactScore: event.impactScore,
          });
        }
      } catch (e) {
        console.error(`[Scheduler] Monitor ${monitor.id} assessment failed:`, e);
      }
    }

    lastRunTime = new Date().toISOString();
  } catch (err) {
    console.error("[Scheduler] Market assessment failed:", err);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  // Seed default monitors on first start
  seedDefaultMonitors();

  const frequencyMin = parseInt(getSetting("search_frequency") || "10", 10);
  const cronExpr = `*/${frequencyMin} * * * *`;

  if (cronJob) {
    cronJob.stop();
  }

  cronJob = cron.schedule(cronExpr, runMarketAssessment);
  console.log(`[Scheduler] Started with frequency: every ${frequencyMin} min`);

  // Run first assessment immediately (async, don't block startup)
  if (!firstRunDone) {
    firstRunDone = true;
    setTimeout(() => runMarketAssessment(), 3000);
  }
}

export function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[Scheduler] Stopped");
  }
}

export function restartScheduler() {
  stopScheduler();
  startScheduler();
}
