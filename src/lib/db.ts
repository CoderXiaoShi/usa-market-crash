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

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  insertSetting.run("search_frequency", "10");
}

// ---- Snapshot ----

export function getLatestSnapshot() {
  const d = getDb();
  return d
    .prepare("SELECT * FROM probability_snapshots ORDER BY created_at DESC LIMIT 1")
    .get() as ProbabilitySnapshot | undefined;
}

export function getSnapshot(id: string) {
  const d = getDb();
  return d
    .prepare("SELECT * FROM probability_snapshots WHERE id = ?")
    .get(id) as ProbabilitySnapshot | undefined;
}

export function updateSnapshotFactors(id: string, factors: Factor[]) {
  const d = getDb();
  // Recompute probability from factors
  const n = factors.length;
  const total = factors.reduce((s, f) => s + f.impact, 0);
  const maxTotal = n * 10;
  const probability =
    maxTotal === 0 ? 50 : Math.round(50 + (total / maxTotal) * 50);

  d.prepare(
    "UPDATE probability_snapshots SET factors_json = ?, probability = ? WHERE id = ?"
  ).run(JSON.stringify(factors), Math.max(0, Math.min(100, probability)), id);

  return { probability, factors };
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
  return { id, name: input.name, search_prompt: input.searchPrompt, status: "active", created_at: now } as Monitor;
}

export function updateMonitorStatus(id: string, status: "active" | "paused") {
  const d = getDb();
  d.prepare("UPDATE monitors SET status = ? WHERE id = ?").run(status, id);
}

export function updateMonitor(
  id: string,
  updates: { name?: string; searchPrompt?: string; status?: "active" | "paused" }
) {
  const d = getDb();
  const sets: string[] = [];
  const vals: string[] = [];
  if (updates.name) { sets.push("name = ?"); vals.push(updates.name); }
  if (updates.searchPrompt) { sets.push("search_prompt = ?"); vals.push(updates.searchPrompt); }
  if (updates.status) { sets.push("status = ?"); vals.push(updates.status); }
  if (sets.length === 0) return;
  vals.push(id);
  d.prepare(`UPDATE monitors SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function deleteMonitor(id: string) {
  const d = getDb();
  d.prepare("DELETE FROM monitors WHERE id = ?").run(id);
}

// ---- Seed Default Monitors (高志凯框架) ----

const DEFAULT_MONITORS = [
  {
    name: "美债利率与到期风险",
    searchPrompt:
      "监控美国国债市场：联邦国债总量及利息支出变化、10Y-2Y利差变化、美债拍卖bid-to-cover比率、外国官方持有美债占比（特别是中日、中东主权基金减持动向）。重点：美国39万亿国债中，约10万亿早年低息旧债将在未来一年多集中到期，必须在4%以上高利率环境续发，融资成本翻倍。高志凯框架认为这是美股根基崩塌的第一引爆点。",
  },
  {
    name: "AI泡沫与企业营收",
    searchPrompt:
      "监控美股七大科技巨头（微软、英伟达、谷歌、Meta、苹果、亚马逊、特斯拉）的AI资本开支vs真实落地营收（当前约16:1严重失衡）、高管减持套现规模、标普500指数集中度（七巨头权重是否持续攀升）。重点：AI行业是否仍是闭环互买的账面游戏（英伟达→OpenAI→甲骨文→英伟达），是否有AI企业出现大额亏损。关键前提：美国能否通过技术封锁垄断AI红利，中国AI产业链自主能力是泡沫能否持续的试金石。高志凯框架认为这是第二引爆点。",
  },
  {
    name: "商业地产与银行坏账",
    searchPrompt:
      "监控美国商业地产市场：写字楼空置率、CMBS整体及写字楼分项违约率、中小区域银行商业地产贷款敞口及拨备覆盖率。关注是否有银行出现类似硅谷银行的流动性危机信号。美联储政策两难：若降息则通胀反弹，维持高利率则债务/股市/地产全线承压。高志凯框架认为这是崩盘放大器。",
  },
  {
    name: "VIX恐慌指数与市场情绪",
    searchPrompt:
      "监控VIX恐慌指数、信用利差（投资级与高收益债利差）、标普500波动率、市场资金流向。高志凯框架认为当VIX持续高于25且信用利差扩大，意味着市场开始定价崩盘风险，恐慌情绪自我强化会加速资金撤离。",
  },
  {
    name: "去美元化与央行黄金储备",
    searchPrompt:
      "监控去美元化趋势：全球央行（特别是中国、中东、新兴市场）黄金储备增持量及增持速度、美元在全球外汇储备中占比变化、主要主权财富基金（挪威GPFG、中东ADIA/KIA/PIF、新加坡GIC、中国CIC）对美股美债的减持动态、SWIFT人民币结算占比变化。高志凯框架认为美元信用受损是危机传导链的关键环节，如果去美元化加速说明美元资产定价基础在动摇。",
  },
  {
    name: "地缘政治与能源风险",
    searchPrompt:
      "监控全球重大地缘政治事件、能源价格波动、供应链中断风险。高志凯明确指出：地缘冲突会进一步放大风险，能源和大宗商品剧烈波动会加剧全球经济衰退，加速危机传导。",
  },
];

export function seedDefaultMonitors() {
  const d = getDb();
  const existing = d.prepare("SELECT COUNT(*) as count FROM monitors").get() as {
    count: number;
  };
  if (existing.count > 0) return; // Already seeded

  const stmt = d.prepare(
    "INSERT INTO monitors (id, name, search_prompt, status, created_at) VALUES (?, ?, ?, 'active', ?)"
  );

  const insertMany = d.transaction(() => {
    for (const m of DEFAULT_MONITORS) {
      stmt.run(uuid(), m.name, m.searchPrompt, new Date().toISOString());
    }
  });

  insertMany();
  console.log(`[DB] Seeded ${DEFAULT_MONITORS.length} default monitors`);
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

// ---- Chat Messages ----

export function getChatMessages(limit = 100) {
  const d = getDb();
  return d
    .prepare("SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT ?")
    .all(limit) as ChatMessage[];
}

export function insertChatMessage(msg: { role: string; content: string }) {
  const d = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  d.prepare(
    "INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, msg.role, msg.content, now);
  return { id, ...msg, created_at: now } as ChatMessage;
}

// ---- Types ----

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

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
