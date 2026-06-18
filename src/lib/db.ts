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

export function deleteMonitor(id: string) {
  const d = getDb();
  d.prepare("DELETE FROM monitors WHERE id = ?").run(id);
}

// ---- Seed Default Monitors (高志凯框架) ----

const DEFAULT_MONITORS = [
  {
    name: "美债利率与到期风险",
    searchPrompt:
      "监控美国国债市场：10年期-2年期利差变化、美债拍卖bid-to-cover比率、外国持有美债占比、美联储利率政策表态。重点关注美国39万亿国债的滚动续发压力和利息支出变化。",
  },
  {
    name: "AI泡沫与企业营收",
    searchPrompt:
      "监控美股七大科技巨头（微软、英伟达、谷歌、Meta、苹果、亚马逊、特斯拉）的AI资本开支、实际AI营收落地、高管减持套现情况。计算AI投入产出比，关注是否有AI企业出现大额亏损或估值下调。",
  },
  {
    name: "商业地产与银行坏账",
    searchPrompt:
      "监控美国商业地产市场：写字楼空置率、CMBS违约率、中小区域银行商业地产贷款敞口。关注是否有银行出现类似硅谷银行的流动性危机信号。",
  },
  {
    name: "VIX恐慌指数与市场情绪",
    searchPrompt:
      "监控VIX恐慌指数、标普500波动率、信用利差（投资级与高收益债利差）、市场资金流向。如果VIX持续高于25且信用利差扩大，说明市场情绪恶化。",
  },
  {
    name: "全球央行黄金储备变化",
    searchPrompt:
      "监控全球央行（特别是中国、中东、新兴市场）的黄金储备增持情况、美元在全球外汇储备中的占比变化。如果去美元化加速，说明美元信用持续受损。",
  },
  {
    name: "地缘政治与能源风险",
    searchPrompt:
      "监控全球重大地缘政治事件、能源价格波动、供应链中断风险。地缘冲突会放大能源和大宗商品波动，加剧全球衰退风险。",
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
