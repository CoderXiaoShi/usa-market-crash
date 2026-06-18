# 美股崩盘概率监测平台 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 AI 驱动、定时采集全网信息、实时展示美股崩盘概率的个人监测平台。

**Architecture:** Next.js App Router 单体应用，SQLite 存储，OpenAI API 驱动搜索/分析/对话，node-cron 定时调度。

**Tech Stack:** Next.js 15 + better-sqlite3 + openai SDK + node-cron + Tailwind CSS 3 + TypeScript

---

## File Structure Map

```
usa-market-crash/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局 + metadata
│   │   ├── page.tsx                # 主页面 (Server Component)
│   │   ├── globals.css             # Tailwind + CSS 变量
│   │   ├── actions.ts              # Server Actions
│   │   ├── api/
│   │   │   ├── chat/route.ts       # POST - 流式聊天
│   │   │   ├── monitors/route.ts   # GET/POST
│   │   │   ├── monitors/[id]/route.ts  # PATCH/DELETE
│   │   │   ├── probability/route.ts    # GET 最新概率
│   │   │   └── settings/route.ts   # GET/PATCH
│   ├── lib/
│   │   ├── db.ts                   # SQLite 初始化 + schema + 查询封装
│   │   ├── ai.ts                   # OpenAI 调用封装
│   │   └── scheduler.ts            # node-cron 定时任务
│   └── components/
│       ├── ProbabilityGauge.tsx     # "use client" - SVG 环形进度条
│       ├── FactorsPanel.tsx         # "use client" - 影响因素列表
│       ├── ChatPanel.tsx            # "use client" - 流式聊天
│       ├── MonitorDialog.tsx        # "use client" - 新增监控弹窗
│       └── SettingsBar.tsx          # "use client" - 设置栏
├── data/                            # SQLite 数据文件 (自动创建)
├── instrumentation.ts               # Next.js 启动钩子，注册 cron
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

---

### Task 1: 脚手架 & 依赖安装

- [ ] **Step 1: 用 create-next-app 创建项目骨架**

```bash
cd /Users/shixinglong/sxl/gitee/usa-market-crash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm 2>&1
```

Expected: 生成 Next.js 项目文件，包括 `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 2: 安装额外依赖**

```bash
cd /Users/shixinglong/sxl/gitee/usa-market-crash
npm install better-sqlite3 openai node-cron uuid
npm install -D @types/better-sqlite3 @types/node-cron @types/uuid
```

- [ ] **Step 3: 配置 next.config.ts 支持 better-sqlite3**

Read `next.config.ts`, then replace its content:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Step 4: 创建 data 目录**

```bash
mkdir -p /Users/shixinglong/sxl/gitee/usa-market-crash/data
```

- [ ] **Step 5: 验证脚手架**

```bash
cd /Users/shixinglong/sxl/gitee/usa-market-crash && npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1 2>/dev/null
```

Expected: 返回 HTML 页面内容（默认的 Next.js 欢迎页）

---

### Task 2: 数据库层 (src/lib/db.ts)

**Files:** Create `src/lib/db.ts`

- [ ] **Step 1: 创建完整的 db.ts**

```typescript
import Database from "better-sqlite3";
import path from "path";
import { v4 as uuid } from "uuid";

const DB_PATH = path.join(process.cwd(), "data", "market-crash.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    createTables(db);
  }
  return db;
}

function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      search_prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitor_events (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      content TEXT NOT NULL,
      impact_desc TEXT NOT NULL,
      impact_score REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS probability_snapshots (
      id TEXT PRIMARY KEY,
      probability REAL NOT NULL,
      factors_json TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert default settings if not present
  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  insertSetting.run("search_frequency", "10");
  insertSetting.run("openai_api_key", "");
  insertSetting.run("openai_model", "gpt-4o");
}

// ---- Snapshot ----

export function getLatestSnapshot() {
  const d = getDb();
  return d
    .prepare("SELECT * FROM probability_snapshots ORDER BY created_at DESC LIMIT 1")
    .get() as ProbabilitySnapshot | undefined;
}

export function insertSnapshot(snapshot: {
  probability: number;
  factorsJson: string;
  summary: string;
}) {
  const d = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  d.prepare(
    "INSERT INTO probability_snapshots (id, probability, factors_json, summary, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, snapshot.probability, snapshot.factorsJson, snapshot.summary, now);
  return { id, ...snapshot, createdAt: now };
}

export function getSnapshots(limit = 50) {
  const d = getDb();
  return d
    .prepare("SELECT * FROM probability_snapshots ORDER BY created_at DESC LIMIT ?")
    .all(limit) as ProbabilitySnapshot[];
}

// ---- Monitors ----

export function listMonitors() {
  const d = getDb();
  return d
    .prepare("SELECT * FROM monitors ORDER BY created_at DESC")
    .all() as Monitor[];
}

export function getMonitor(id: string) {
  const d = getDb();
  return d.prepare("SELECT * FROM monitors WHERE id = ?").get(id) as Monitor | undefined;
}

export function createMonitor(input: { name: string; searchPrompt: string }) {
  const d = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  d.prepare(
    "INSERT INTO monitors (id, name, search_prompt, status, created_at) VALUES (?, ?, ?, 'active', ?)"
  ).run(id, input.name, input.searchPrompt, now);
  return { id, ...input, status: "active", createdAt: now } as Monitor;
}

export function updateMonitorStatus(id: string, status: "active" | "paused") {
  const d = getDb();
  d.prepare("UPDATE monitors SET status = ? WHERE id = ?").run(status, id);
}

export function deleteMonitor(id: string) {
  const d = getDb();
  d.prepare("DELETE FROM monitors WHERE id = ?").run(id);
}

// ---- Monitor Events ----

export function insertMonitorEvent(event: {
  monitorId: string;
  content: string;
  impactDesc: string;
  impactScore: number;
}) {
  const d = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  d.prepare(
    "INSERT INTO monitor_events (id, monitor_id, content, impact_desc, impact_score, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, event.monitorId, event.content, event.impactDesc, event.impactScore, now);
  return { id, ...event, createdAt: now };
}

export function getMonitorEvents(monitorId: string, limit = 20) {
  const d = getDb();
  return d
    .prepare(
      "SELECT * FROM monitor_events WHERE monitor_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(monitorId, limit) as MonitorEvent[];
}

// ---- Settings ----

export function getSetting(key: string): string | undefined {
  const d = getDb();
  const row = d
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  const d = getDb();
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    key,
    value
  );
}

export function getAllSettings() {
  const d = getDb();
  const rows = d.prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ---- Types ----

export interface Monitor {
  id: string;
  name: string;
  search_prompt: string;
  status: string;
  created_at: string;
}

export interface MonitorEvent {
  id: string;
  monitor_id: string;
  content: string;
  impact_desc: string;
  impact_score: number;
  created_at: string;
}

export interface ProbabilitySnapshot {
  id: string;
  probability: number;
  factors_json: string;
  summary: string;
  created_at: string;
}

export interface Factor {
  event: string;
  impact: number;
  description: string;
}
```

- [ ] **Step 2: 验证数据库初始化**

Run this one-off check in the project directory to confirm the DB creates correctly:

```bash
cd /Users/shixinglong/sxl/gitee/usa-market-crash
node -e "
const { getLatestSnapshot, listMonitors, getSetting, insertSnapshot, createMonitor } = require('./src/lib/db.ts');
" 2>&1 || echo "---"
# This will fail because .ts can't be required directly; use npx tsx instead:
npx tsx -e "
import { getLatestSnapshot, listMonitors, getSetting, insertSnapshot, createMonitor } from './src/lib/db';
const s = getSetting('search_frequency');
console.log('search_frequency:', s);
console.log('latest snapshot:', getLatestSnapshot());
console.log('monitors:', listMonitors());
console.log('DB OK');
"
```

Expected output: `search_frequency: 10`, `latest snapshot: undefined`, `monitors: []`, `DB OK`

---

### Task 3: AI 引擎 (src/lib/ai.ts)

**Files:** Create `src/lib/ai.ts`

The AI engine wraps OpenAI with three capabilities:
1. `assessMarket()` — calls GPT-4o with web_search, returns structured crash probability + factors
2. `chat()` — streaming chat with market context
3. `parseMonitorDescription()` — parses user's natural language into a monitor config

- [ ] **Step 1: 创建 src/lib/ai.ts**

```typescript
import OpenAI from "openai";
import { getSetting } from "./db";

function getClient(): OpenAI | null {
  const apiKey = getSetting("openai_api_key");
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return getSetting("openai_model") || "gpt-4o";
}

// ------- Market Assessment -------

interface AssessResult {
  probability: number;
  summary: string;
  factors: Array<{
    event: string;
    impact: number;
    description: string;
  }>;
}

const MARKET_PROMPT = `你是一位资深美股市场分析师。请使用网络搜索获取最新的市场数据，然后综合评估美股崩盘概率。

请搜索以下关键指标：
- VIX恐慌指数当前值
- 美债10年期-2年期收益率利差
- 美国失业率最新数据
- 核心CPI通胀数据
- 美联储最新利率决议与政策表态
- 标普500近期走势与估值
- 近期重大地缘政治或经济事件

根据搜索结果，输出一个 JSON 对象（不要包含 markdown 代码块标记）：

{
  "probability": 数字(0-100, 崩盘百分比),
  "summary": "中文综合评述, 约200字",
  "factors": [
    {"event": "具体事件或数据描述", "impact": 数字(-10到+10, 正值增加崩盘风险), "description": "一两句解释为什么这个因素影响了判断"}
  ]
}`;

export async function assessMarket(): Promise<AssessResult | null> {
  const client = getClient();
  if (!client) throw new Error("OpenAI API key not configured");

  const model = getModel();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: MARKET_PROMPT }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return {
    probability: Math.max(0, Math.min(100, parsed.probability)),
    summary: parsed.summary,
    factors: (parsed.factors || []).map((f: any) => ({
      event: f.event,
      impact: Math.max(-10, Math.min(10, f.impact)),
      description: f.description || "",
    })),
  };
}

// ------- Chat -------

const CHAT_SYSTEM_PROMPT = `你是一位专业的美股市场分析师 AI 助手。你可以提供以下帮助：
- 分析美股市场趋势和风险
- 解读经济数据指标的含义
- 讨论影响美股的各类事件
- 回答关于投资风险的常见问题

请使用中文回复。回答要基于数据驱动，保持客观冷静。可以引用具体数据和历史案例。`;

export async function* chatStream(
  userMessage: string,
  context: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): AsyncGenerator<string> {
  const client = getClient();
  if (!client) throw new Error("OpenAI API key not configured");

  const model = getModel();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    { role: "system", content: `当前市场数据上下文：\n${context}` },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// ------- Custom Monitor Parsing -------

const PARSE_MONITOR_PROMPT = `用户想新增一个美股崩盘概率的监控项。请分析用户的描述，提取关键信息并输出 JSON。

用户描述：
"{userInput}"

请输出 JSON（不要包含 markdown 代码块标记）：
{
  "name": "监控项简短名称(10字以内)",
  "searchKeywords": "AI 搜索时使用的关键词组合",
  "impactLogic": "当搜索到相关事件时，如何判断它对崩盘概率的影响方向(正面/负面)和程度"
}`;

export async function parseMonitorDescription(userInput: string): Promise<{
  name: string;
  searchKeywords: string;
  impactLogic: string;
} | null> {
  const client = getClient();
  if (!client) throw new Error("OpenAI API key not configured");

  const model = getModel();
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: PARSE_MONITOR_PROMPT.replace("{userInput}", userInput),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return {
    name: parsed.name,
    searchKeywords: parsed.searchKeywords,
    impactLogic: parsed.impactLogic,
  };
}

// ------- Custom Monitor Event Assessment -------

export async function assessMonitorEvent(
  searchPrompt: string,
  searchKeywords: string,
  impactLogic: string
): Promise<{
  content: string;
  impactDesc: string;
  impactScore: number;
} | null> {
  const client = getClient();
  if (!client) throw new Error("OpenAI API key not configured");

  const model = getModel();
  const prompt = `请搜索关于 "${searchKeywords}" 的最新信息。

监控目的：${searchPrompt}
影响逻辑：${impactLogic}

请根据搜索结果，判断是否有值得关注的事件。如果有，评估该事件对美股崩盘概率的影响（-10到+10，正值表示增加崩盘风险）。

输出 JSON（不要包含 markdown 代码块标记）：
{
  "hasEvent": true 或 false,
  "content": "搜索到的事件描述(如果hasEvent为false则写无)",
  "impactDesc": "该事件如何影响美股崩盘概率的判断",
  "impactScore": 影响评分(-10到+10)
}`;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  if (!parsed.hasEvent) return null;

  return {
    content: parsed.content,
    impactDesc: parsed.impactDesc,
    impactScore: Math.max(-10, Math.min(10, parsed.impactScore)),
  };
}
```

---

### Task 4: API 路由——设置 & 概率 & 监控

These are the data-serving API routes. All are server-side only.

- [ ] **Step 1: GET/PATCH settings — `src/app/api/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  // Don't expose full API key to frontend
  const masked = { ...settings };
  if (masked.openai_api_key) {
    masked.openai_api_key =
      masked.openai_api_key.slice(0, 4) +
      "****" +
      masked.openai_api_key.slice(-4);
  }
  return NextResponse.json(masked);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  for (const key of Object.keys(body)) {
    setSetting(key, String(body[key]));
  }
  // Restart scheduler to pick up frequency change
  const { restartScheduler } = await import("@/lib/scheduler");
  restartScheduler();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: GET probability — `src/app/api/probability/route.ts`**

```typescript
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
```

- [ ] **Step 3: CRUD monitors — `src/app/api/monitors/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listMonitors, createMonitor } from "@/lib/db";
import { parseMonitorDescription } from "@/lib/ai";

export async function GET() {
  const monitors = listMonitors();
  return NextResponse.json(monitors);
}

export async function POST(req: NextRequest) {
  const { userInput } = await req.json();

  // Use AI to parse the user's natural language
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
```

- [ ] **Step 4: PATCH/DELETE single monitor — `src/app/api/monitors/[id]/route.ts`**

```typescript
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
```

---

### Task 5: 聊天 API + Server Actions

- [ ] **Step 1: Streaming chat — `src/app/api/chat/route.ts`**

```typescript
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
```

- [ ] **Step 2: Server Actions — `src/app/actions.ts`**

```typescript
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
```

---

### Task 6: 定时调度器 (src/lib/scheduler.ts + instrumentation.ts)

- [ ] **Step 1: 创建 `src/lib/scheduler.ts`**

```typescript
import cron from "node-cron";
import { assessMarket } from "./ai";
import { insertSnapshot, listMonitors, getSetting } from "./db";
import { assessMonitorEvent } from "./ai";
import { insertMonitorEvent } from "./db";

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunTime: string | null = null;

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
        // Parse the monitor's search prompt to extract keywords & logic
        // We'll reuse the stored info; for simplicity, AI does the full assessment
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
  const frequencyMin = parseInt(getSetting("search_frequency") || "10", 10);
  const cronExpr = `*/${frequencyMin} * * * *`;

  if (cronJob) {
    cronJob.stop();
  }

  cronJob = cron.schedule(cronExpr, runMarketAssessment);
  console.log(`[Scheduler] Started with frequency: every ${frequencyMin} min`);
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
```

- [ ] **Step 2: 创建 `instrumentation.ts`（项目根目录）**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
    console.log("[Instrumentation] Scheduler registered");
  }
}
```

---

### Task 7: 全局样式 & 布局

- [ ] **Step 1: 更新 `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0a0a0f;
  --card: #12121a;
  --border: #1e1e30;
  --text: #e4e4e7;
  --muted: #71717a;
  --red: #ef4444;
  --orange: #f97316;
  --green: #22c55e;
  --blue: #3b82f6;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }

@layer components {
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
  }
}
```

- [ ] **Step 2: 更新 `src/app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美股崩盘概率监测",
  description: "AI 驱动的美股崩盘风险实时监测平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

---

### Task 8: ProbabilityGauge 组件

- [ ] **Step 1: 创建 `src/components/ProbabilityGauge.tsx`**

```typescript
"use client";

interface Props {
  probability: number;
}

export default function ProbabilityGauge({ probability }: Props) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - probability / 100);

  const color =
    probability >= 60 ? "var(--red)" : probability >= 30 ? "var(--orange)" : "var(--green)";

  const level =
    probability >= 60 ? "高风险区间" : probability >= 30 ? "中等风险区间" : "低风险区间";

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm text-[var(--muted)] mb-4">当前美股崩盘概率</div>
      <div className="relative w-[200px] h-[200px]">
        <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
          <circle
            cx="100" cy="100" r={radius}
            fill="none" stroke="#1e1e30" strokeWidth="14"
          />
          <circle
            cx="100" cy="100" r={radius}
            fill="none" stroke={color} strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-extrabold tracking-tight" style={{ color }}>
            {probability.toFixed(1)}
            <span className="text-3xl">%</span>
          </span>
        </div>
      </div>
      <div className="text-xs text-[var(--muted)] mt-1">{level}</div>
    </div>
  );
}
```

---

### Task 9: FactorsPanel 组件

- [ ] **Step 1: 创建 `src/components/FactorsPanel.tsx`**

```typescript
"use client";

import type { Factor } from "@/lib/db";

interface Props {
  factors: Factor[];
  onAddMonitor: () => void;
}

export default function FactorsPanel({ factors, onAddMonitor }: Props) {
  return (
    <div className="card p-5 flex flex-col h-full">
      <h2 className="text-[15px] font-semibold mb-4">影响因素</h2>
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {factors.length === 0 && (
          <p className="text-sm text-[var(--muted)]">暂无数据，等待 AI 首次采集...</p>
        )}
        {factors.map((f, i) => (
          <div
            key={i}
            className="flex justify-between items-start gap-3 p-2.5 rounded-lg bg-white/[0.03] text-[13px] leading-relaxed"
          >
            <span className="flex-1 min-w-0">{f.event}</span>
            <span
              className={`shrink-0 ml-2 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                f.impact > 0
                  ? "bg-red-500/15 text-red-400"
                  : "bg-green-500/15 text-green-400"
              }`}
            >
              {f.impact > 0 ? "+" : ""}{f.impact.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onAddMonitor}
        className="mt-4 w-full py-2.5 rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)] text-sm hover:border-[var(--blue)] hover:text-[var(--blue)] transition-colors cursor-pointer"
      >
        + 新增自定义监控
      </button>
    </div>
  );
}
```

---

### Task 10: ChatPanel 组件

- [ ] **Step 1: 创建 `src/components/ChatPanel.tsx`**

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "你好！我是 AI 市场分析助手。你可以问我关于美股市场、风险指标、经济数据等方面的问题。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Update the last message progressively
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: buffer };
          return copy;
        });
      }
    } catch (err: any) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `[错误] ${err.message || "AI 服务暂不可用"}`,
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className={`card overflow-hidden ${collapsed ? "" : ""}`}>
      <div
        className="flex justify-between items-center px-5 py-3.5 border-b border-[var(--border)] text-sm font-semibold cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>AI 市场分析助手</span>
        <span
          className="text-[var(--muted)] transition-transform"
          style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}
        >
          ▾
        </span>
      </div>
      {!collapsed && (
        <>
          <div className="h-[280px] overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] text-[13px] leading-relaxed px-3 py-2.5 rounded-xl ${
                  msg.role === "assistant"
                    ? "bg-white/[0.05] mr-auto"
                    : "bg-blue-500/15 ml-auto"
                }`}
              >
                <div className="text-[11px] text-[var(--muted)] mb-1">
                  {msg.role === "assistant" ? "AI 助手" : "你"}
                </div>
                {msg.content || (loading && msg.role === "assistant" ? "思考中..." : "")}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 px-5 py-3 border-t border-[var(--border)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="输入你的问题..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--blue)] disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-[var(--blue)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

### Task 11: MonitorDialog 组件

- [ ] **Step 1: 创建 `src/components/MonitorDialog.tsx`**

```typescript
"use client";

import { useState } from "react";
import { addMonitor } from "@/app/actions";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MonitorDialog({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("userInput", text);

    const result = await addMonitor(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setText("");
      onClose();
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card p-6 w-[480px] max-w-[90vw]">
        <h3 className="text-base font-semibold mb-4">新增自定义监控</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="用自然语言告诉AI你要监控什么，搜到以后如何影响美股崩盘概率...

例如：关注英伟达股价是否出现单日跌幅超过10%，如果出现说明AI泡沫可能破裂，大幅增加崩盘概率"
          className="w-full h-[120px] px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] resize-y outline-none focus:border-[var(--blue)]"
          style={{ fontFamily: "inherit" }}
        />
        <p className="text-xs text-[var(--muted)] mt-2 mb-4">
          AI 将自动解析你的描述，提取搜索关键词和影响逻辑，定时执行监控。
        </p>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--muted)] text-sm cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--blue)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            {loading ? "解析中..." : "创建监控"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 12: SettingsBar 组件

- [ ] **Step 1: 创建 `src/components/SettingsBar.tsx`**

```typescript
"use client";

interface Props {
  frequency: string;
  lastRunTime: string | null;
}

export default function SettingsBar({ frequency, lastRunTime }: Props) {
  const handleChange = async (val: string) => {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search_frequency: val }),
    });
  };

  const timeAgo = lastRunTime
    ? (() => {
        const diff = Date.now() - new Date(lastRunTime).getTime();
        const min = Math.floor(diff / 60000);
        return min < 1 ? "刚刚" : `${min} 分钟前`;
      })()
    : null;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[var(--green)]" />
        <span className="text-sm text-[var(--muted)]">AI 监控运行中</span>
        {timeAgo && <span className="text-sm text-[var(--muted)]">· {timeAgo} 刷新</span>}
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        AI 搜索频率：
        <select
          defaultValue={frequency}
          onChange={(e) => handleChange(e.target.value)}
          className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--text)] text-sm outline-none cursor-pointer"
        >
          <option value="5">5 分钟</option>
          <option value="10">10 分钟</option>
          <option value="30">30 分钟</option>
          <option value="60">1 小时</option>
          <option value="240">4 小时</option>
        </select>
      </div>
    </div>
  );
}
```

---

### Task 13: 主页面 (src/app/page.tsx)

- [ ] **Step 1: 重写 `src/app/page.tsx`**

```typescript
import { getLatestSnapshot, getAllSettings } from "@/lib/db";
import { getLastRunTime } from "@/lib/scheduler";
import type { Factor } from "@/lib/db";
import ProbabilityGauge from "@/components/ProbabilityGauge";
import ChatPanel from "@/components/ChatPanel";
import SettingsBar from "@/components/SettingsBar";
import ClientShell from "@/components/ClientShell";
import SetupForm from "@/components/SetupForm";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const snapshot = getLatestSnapshot();
  const settings = getAllSettings();
  const lastRunTime = getLastRunTime();

  // API Key not configured → show setup screen
  const apiKey = settings.openai_api_key;
  if (!apiKey) {
    return (
      <div className="max-w-[480px] mx-auto px-6 py-24">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">美股崩盘概率监测</h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            首次使用需要配置 OpenAI API Key
          </p>
          <SetupForm />
        </div>
      </div>
    );
  }

  const probability = snapshot?.probability ?? 0;
  const factors: Factor[] = snapshot?.factors_json
    ? JSON.parse(snapshot.factors_json)
    : [];
  const summary = snapshot?.summary ?? "";
  const frequency = settings.search_frequency || "10";

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-1 pb-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-semibold">美股崩盘概率监测</h1>
      </div>

      {/* Settings */}
      <div className="mt-4">
        <SettingsBar frequency={frequency} lastRunTime={lastRunTime} />
      </div>

      {/* Main 2-column */}
      <div className="grid grid-cols-[1fr_340px] gap-6 mb-6 max-md:grid-cols-1">
        {/* Left: Probability */}
        <div className="card p-8 flex flex-col items-center">
          <ProbabilityGauge probability={probability} />
          {summary && (
            <div className="mt-5 p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-sm leading-relaxed text-[#d4d4d8]">
              <strong className="text-red-400">AI 综合评述：</strong>
              {summary}
            </div>
          )}
        </div>

        {/* Right: Factors */}
        <ClientShell factors={factors} />
      </div>

      {/* Bottom: Chat */}
      <ChatPanel />
    </div>
  );
}
```

---

### Task 14: ClientShell 组件（桥接 Server/Client）

- [ ] **Step 1: 创建 `src/components/ClientShell.tsx`**

```typescript
"use client";

import { useState } from "react";
import FactorsPanel from "./FactorsPanel";
import MonitorDialog from "./MonitorDialog";
import type { Factor } from "@/lib/db";

interface Props {
  factors: Factor[];
}

export default function ClientShell({ factors }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <FactorsPanel factors={factors} onAddMonitor={() => setDialogOpen(true)} />
      <MonitorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
```

This small component is the bridge: the page is a Server Component that can call `getLatestSnapshot()` directly, but the "新增自定义监控" button needs client-side state. `ClientShell` wraps that interactivity boundary.

---

### Task 15: SetupForm 组件（API Key 初始化）

- [ ] **Step 1: 创建 `src/components/SetupForm.tsx`**

```typescript
"use client";

import { useState } from "react";

export default function SetupForm() {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openai_api_key: key }),
    });
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-..."
        className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
      />
      <button
        onClick={save}
        disabled={saving || !key.trim()}
        className="w-full py-2.5 rounded-lg bg-[var(--blue)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
      >
        {saving ? "保存中..." : "开始使用"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        API Key 仅保存在本地 SQLite 数据库中，不会上传到任何服务器
      </p>
    </div>
  );
}
```

---

### Task 16: 验证 & 集成测试

- [ ] **Step 1: 启动开发服务器并验证**

```bash
cd /Users/shixinglong/sxl/gitee/usa-market-crash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -50
```

Expected: 页面返回，包含"美股崩盘概率监测"标题和 API Key 输入表单

- [ ] **Step 2: 测试 API 路由**

```bash
# Test probability endpoint
curl -s http://localhost:3000/api/probability
# Expected: {"probability":0,"factors":[],"summary":"","createdAt":null}

# Test settings endpoint
curl -s http://localhost:3000/api/settings
# Expected: {"search_frequency":"10","openai_api_key":"","openai_model":"gpt-4o"}

# Test monitors endpoint
curl -s http://localhost:3000/api/monitors
# Expected: []
```

- [ ] **Step 3: 配置 API Key 并触发首次评估**

```bash
# Set API key (replace with actual key or skip if not available)
curl -s -X PATCH http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"openai_api_key": "sk-test1234"}'

# Trigger one manual assessment via API or wait for cron
```

- [ ] **Step 4: TypeScript 编译检查**

```bash
cd /Users/shixinglong/sxl/gitee/usa-market-crash
npx tsc --noEmit 2>&1
```

Expected: 无类型错误

- [ ] **Step 5: Kill dev server**

```bash
kill %1 2>/dev/null
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| 美股崩盘概率展示 | Task 8 (Gauge), Task 13 (page) |
| 影响因素列表 | Task 9 (FactorsPanel), Task 13 (page) |
| AI 定时搜索全网数据 | Task 3 (ai.ts), Task 6 (scheduler) |
| 搜索频率用户可选 | Task 12 (SettingsBar), Task 4 (settings API) |
| AI 对话（流式） | Task 5 (chat route), Task 10 (ChatPanel) |
| 用户新增自定义监控 | Task 11 (MonitorDialog), Task 4 (monitors API), Task 3 (parseMonitor) |
| 监控项可开关 | Task 4 (PATCH monitors/:id) |
| SQLite 持久化存储 | Task 2 (db.ts) |
| 5 分钟页面自动刷新 | Handled by `export const dynamic = "force-dynamic"` + client polling (Task 13) |
| API Key 配置 | Task 15 (SetupForm) |
| 错误处理（API 失败重试/降级） | Task 3 (ai.ts 返回 null 时上层处理), Task 6 (try/catch) |
