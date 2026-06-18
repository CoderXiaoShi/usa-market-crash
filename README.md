# 美股崩盘概率监测平台

AI 驱动的美股崩盘风险实时监测系统，基于高志凯金融危机预警框架。

## 需求背景

2026 年 5 月 27 日，高志凯在深圳凤凰湾区财经论坛发表公开演讲，提出对美股及全球金融市场的系统性预警：

> "非常明确、不模糊的预判：从 2026 年年初算起，未来 12 到 18 个月，也就是 **2026 年末至 2027 年上半年**，全球会爆发一场系统性、世界级金融危机。这场危机的破坏力度，大概是 2000 年互联网泡沫破裂的十倍，整体冲击烈度会远超 2008 年次贷危机。"

高志凯指出，这次危机与以往不同——2008 年是私人部门次贷危机，政府还有财政空间救市；而接下来的是**国家主权债务 + 巨型科技资产泡沫双重共振**，美国政府自身已经债台高筑，没有充足弹药大规模救市。

### 三大引爆点

1. **美债庞氏骗局** — 美国联邦国债突破 39 万亿美元（GDP 127%），利息支出超国防预算，未来一年多约 10 万亿低息旧债集中到期需高息续发，中日中东持续减持美债
2. **AI 巨型泡沫** — 科技七巨头 AI 资本开支超 6000 亿美元，真实落地营收仅约 350 亿美元（16:1），行业是闭环互买的账面游戏，美国无法垄断 AI 技术红利
3. **商业地产与银行坏账** — 写字楼空置率与 CMBS 违约率走高，中小银行商业地产贷款敞口恶化，美联储陷入降息通胀反弹与维持高利率全线承压的两难

### 危机传导链

> 美股崩盘 → 全球风险资产同步杀估值 → 美元信用受损 → 全球央行增持黄金 → 流动性枯竭 → 中小企业倒闭潮 → 地缘冲突放大风险

## 功能

- **崩盘概率仪表盘** — 实时展示崩盘概率（0-100%），基于因素得分动态推导
- **影响因素面板** — 列出影响崩盘概率的关键事件及其贡献百分比，支持在线编辑和删除
- **定时市场评估** — 可配置频率（5/10/30/60/240 分钟），自动调用 AI 评估三大引爆点当前态势
- **自定义监控项** — 内置 6 个核心监控项（美债、AI 泡沫、商业地产、VIX、去美元化、地缘政治），支持新增自定义项
- **AI 聊天助手** — 基于高志凯框架的市场分析对话，支持 Markdown 渲染和流式输出
- **聊天记录持久化** — 对话历史保存至 SQLite 数据库，刷新不丢失

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router + Turbopack) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 数据库 | better-sqlite3 (SQLite) |
| AI 模型 | DeepSeek API (`deepseek-v4-pro`) |
| 任务调度 | node-cron |
| 包管理 | pnpm |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
LLM_API_KEY=your-deepseek-api-key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-v4-pro
```

### 3. 启动开发服务器

```bash
pnpm dev
```

打开 http://localhost:3000 查看效果。

首次启动时，系统会自动：
- 创建 SQLite 数据库和表
- 种子化 6 个默认监控项
- 3 秒后执行第一次市场评估

### 4. 生产构建

```bash
pnpm build
pnpm start
```

## 项目结构

```
src/
├── app/
│   ├── page.tsx                  # 主仪表盘页面
│   ├── layout.tsx                # 根布局（暗色主题）
│   ├── globals.css               # 全局样式 + Markdown 样式
│   ├── actions.ts                # Server Actions
│   └── api/
│       ├── chat/
│       │   ├── route.ts          # 聊天流式接口
│       │   └── messages/route.ts # 聊天记录 CRUD
│       ├── monitors/
│       │   ├── route.ts          # 监控项列表/创建
│       │   └── [id]/route.ts     # 监控项修改/删除
│       ├── probability/
│       │   ├── route.ts          # 最新概率查询
│       │   └── refresh/route.ts  # 手动触发评估
│       ├── settings/route.ts     # 系统设置
│       └── snapshot/
│           └── factors/route.ts  # 因素编辑/删除
├── components/
│   ├── ChatPanel.tsx             # AI 聊天面板
│   ├── ClientShell.tsx           # 客户端容器
│   ├── FactorsPanel.tsx          # 影响因素面板（支持编辑删除）
│   ├── MonitorDialog.tsx         # 新增监控弹窗
│   ├── ProbabilityGauge.tsx      # SVG 环形仪表盘
│   └── SettingsBar.tsx           # 频率选择 + 状态栏
├── lib/
│   ├── ai.ts                     # AI 引擎（DeepSeek API + 高志凯提示词）
│   ├── db.ts                     # SQLite 数据库层
│   └── scheduler.ts              # node-cron 定时任务
└── instrumentation.ts            # Next.js 启动钩子
```

## 概率计算

崩盘概率由影响因素得分动态推导：

```
概率 = 35 + (∑impact / (因素数 × 10)) × 55

基准 35%（崩盘监测系统的合理先验）
范围 10% ~ 90%
```

- 全部验证高志凯框架（all +10）：90%
- 全部证伪高志凯框架（all -10）：10%

## 许可证

MIT
