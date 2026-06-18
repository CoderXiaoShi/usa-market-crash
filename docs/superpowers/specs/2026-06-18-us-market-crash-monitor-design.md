# 美股崩盘概率监测平台 — 设计文档

## 概述

基于 AI 驱动的美股崩盘概率实时监测平台。AI 定时搜索全网数据，综合评估崩盘概率；用户可与 AI 对话讨论市场，也可新增自定义监控项。

- **目标用户：** 个人使用
- **部署：** 单机，npm run dev / production build
- **技术栈：** Next.js App Router + better-sqlite3 + OpenAI API + Tailwind CSS

---

## 架构

```
┌─────────────────────────────────────────────────┐
│                   Next.js App                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Dashboard │  │ AI Chat  │  │ Monitor Mgmt  │  │
│  │ (SSR)     │  │ (Client) │  │ (Client)      │  │
│  └─────┬─────┘  └────┬────┘  └──────┬────────┘  │
│        │             │              │            │
│  ┌─────▼─────────────▼──────────────▼─────────┐  │
│  │        Server Actions / API Routes         │  │
│  └─────┬─────────────┬──────────────┬─────────┘  │
│        │             │              │            │
│  ┌─────▼──────┐ ┌────▼──────┐ ┌───▼──────────┐  │
│  │ AI Engine  │ │ Scheduler │ │ SQLite (bs3) │  │
│  │ (OpenAI)   │ │(node-cron)│ │              │  │
│  └────────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 数据模型

### monitors
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 监控项名称 |
| search_prompt | TEXT | 用户原始描述，如"关注美联储加息动态" |
| status | TEXT | active / paused |
| created_at | TEXT | ISO 8601 |

### monitor_events
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| monitor_id | TEXT | 外键 → monitors.id |
| content | TEXT | 搜索到的事件描述 |
| impact_desc | TEXT | 该事件如何影响美股 |
| impact_score | REAL | 影响评分，范围 -10 ~ +10 |
| created_at | TEXT | ISO 8601 |

### probability_snapshots
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| probability | REAL | 崩盘概率百分比 (0-100) |
| factors_json | TEXT | JSON 数组，影响因子列表 [{event, impact}] |
| summary | TEXT | AI 综合评述 |
| created_at | TEXT | ISO 8601 |

### settings
| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT | 主键，如 search_frequency, openai_api_key |
| value | TEXT | 对应值 |

---

## UI 布局

单页应用，分三块区域：

- **左侧主面板：** 大数字显示崩盘概率（百分比 + 环形进度条），下方 AI 综合评述
- **右侧因素面板：** 影响因素列表（事件描述 + 影响分值），新增监控项按钮
- **底部对话区：** 可折叠的 AI 聊天窗口，上下文自动带入当前概率和事件数据

页面每 5 分钟自动刷新数据。

---

## 数据流

### 1. AI 定时搜索 & 概率评估
```
Scheduler(node-cron) → 触发 → AI Engine
  → OpenAI 搜索全网市场数据
  → 综合评估崩盘概率
  → 写入 probability_snapshots + monitor_events
  → Dashboard 下次刷新时展示新数据
```
- 默认频率：10 分钟（用户可在设置中修改）
- 每次搜索范围：美股主要指标（VIX、美债收益率、失业率、CPI、美联储政策等）+ 重大新闻事件

### 2. Dashboard 展示
```
用户访问页面
  → Server Component 读取最新 probability_snapshot
  → 渲染概率、影响因素列表、AI 评述
  → 客户端每 5 分钟轮询刷新
```

### 3. AI 对话
```
用户输入消息
  → Server Action 发送到 OpenAI
  → 系统提示词带当前概率、影响因素上下文
  → AI 回复分析/讨论
  → 流式返回 (streaming)
```

### 4. 用户新增自定义监控
```
用户输入自然语言描述（如"关注英伟达股价异动，如果暴跌可能引发AI泡沫破裂"）
  → AI Engine 解析：提取搜索关键词 + 影响逻辑
  → 创建 monitor 记录
  → Scheduler 下次循环会带上该监控项一起搜索
  → 搜索结果 → AI 评估影响 → monitor_events
```

---

## 错误处理

- OpenAI API 调用失败：重试 2 次，仍失败则在 UI 显示"AI 服务暂不可用"，保留上次数据
- 网络搜索无结果：记录为空，不影响概率计算
- 数据库写入失败：日志输出错误，不崩溃进程

---

## 项目结构

```
usa-market-crash/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根布局
│   │   ├── page.tsx             # 主页面 (Server Component)
│   │   ├── api/
│   │   │   ├── chat/route.ts    # 聊天 API
│   │   │   ├── monitors/route.ts # 监控项 CRUD
│   │   │   └── settings/route.ts # 设置 API
│   │   └── actions.ts           # Server Actions
│   ├── lib/
│   │   ├── db.ts                # SQLite 初始化 & 查询封装
│   │   ├── ai.ts                # OpenAI 调用封装
│   │   └── scheduler.ts         # node-cron 定时任务
│   └── components/
│       ├── ProbabilityGauge.tsx # 环形进度条
│       ├── FactorsPanel.tsx     # 影响因素列表
│       ├── MonitorForm.tsx      # 新增监控表单
│       └── ChatPanel.tsx        # AI 聊天面板
├── data/
│   └── market-crash.db          # SQLite 数据库文件
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## 待确认项

- [x] 技术栈：Next.js + better-sqlite3 + OpenAI + Tailwind CSS
- [x] 部署方式：单机 (npm run dev / build)
- [x] 崩盘概率计算方式：AI 综合判断
- [x] 搜索频率：默认 10 分钟，用户可配置
- [x] 自定义监控流程：全自动（自然语言 → AI 拆解 → 执行 → 评估）
- [x] 页面刷新间隔：5 分钟
