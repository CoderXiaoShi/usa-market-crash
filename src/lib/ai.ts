import OpenAI from "openai";

const API_KEY = process.env.LLM_API_KEY;
const BASE_URL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
const MODEL = process.env.LLM_MODEL || "deepseek-v4-pro";

function getClient(): OpenAI {
  if (!API_KEY) throw new Error("LLM_API_KEY not configured in .env");
  return new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
}

function getModel(): string {
  return MODEL;
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

const MARKET_PROMPT = `你是一位资深全球宏观分析师。请按照以下「高志凯金融危机预警框架」，基于你对全球宏观经济、美股市场的最新认知，综合评估美股崩盘概率。

## 评估框架：三大引爆点

### 一、美债庞氏骗局——美股根基崩塌
- 美国联邦国债总量已突破39万亿美元，占GDP 127%（远超60%国际安全线）
- 2026财年国债利息支出1.23万亿美元，超过全年国防预算
- 未来一年多约10万亿美元早年低息旧债集中到期，必须在4%以上高利率环境续发
- 中日、中东等主要美债持有国持续减持，海外买盘越来越少
- 关键指标：10Y-2Y利差、美债拍卖bid-to-cover比率、外国持有美债占比变化

### 二、AI巨型泡沫——无真实盈利支撑的资本游戏
- 美股上涨几乎全部靠微软、英伟达、谷歌、Meta、苹果、亚马逊七大科技巨头拉动
- 美国科技巨头累计AI资本开支超6000亿美元，但真实落地营收仅约350亿美元（投入产出比16:1）
- 行业是闭环互买的账面游戏：英伟达→OpenAI→甲骨文→英伟达，资金在小圈子循环
- AI企业高管集体高位套现，一边讲故事一边减持
- 关键指标：科技七巨头占标普500权重、AI相关资本开支/营收比、高管减持规模

### 三、商业地产与银行隐性坏账——崩盘放大器
- 远程办公常态化，写字楼空置率居高不下，商业地产贷款违约率逐月走高
- 大量中小区域银行重仓商业地产信贷，资产质量持续恶化
- 美联储被行政干预，货币政策独立性受损：降息→通胀反弹；维持高利率→债务/股市/地产全线承压
- 关键指标：CMBS违约率、中小银行商业地产贷款敞口、美联储政策路径

### 危机传导逻辑
美股（全球资产定价锚）一旦崩盘 → 全球风险资产同步杀估值 → 美元信用受损 → 全球央行增持黄金 → 流动性枯竭 → 中小企业倒闭潮

### 时间窗口
2026年末至2027年上半年，基于债务到期周期、AI资本开支周期、美联储利率周期三重数据推演。

---

请根据以上框架，评估以下维度的最新情况，输出一个 JSON 对象（不要包含 markdown 代码块标记）：

{
  "probability": 数字(0-100, 代表未来6-12个月内美股崩盘概率),
  "summary": "中文综合评述, 约300字，按三大引爆点逐一说明当前态势",
  "factors": [
    {"event": "具体事件或数据描述", "impact": 数字(-10到+10, 正值表示增加崩盘风险), "description": "一两句解释影响逻辑"}
  ]
}

要求：
1. 每个 factor 都要有具体数据或事件支撑，不能空泛
2. 重点关注美债利率、AI泡沫、商业地产三条主线的交叉验证
3. 如果发现三条引爆线中任何一条出现加速恶化信号，概率应显著上调
4. 该发言为2026年5月27日论坛公开演讲，请结合最新实际数据验证或修正其判断`;

export async function assessMarket(): Promise<AssessResult | null> {
  const client = getClient();
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

const CHAT_SYSTEM_PROMPT = `你是一位专业的美股市场分析师 AI 助手。你的分析框架基于「高志凯金融危机预警体系」，重点关注：美债庞氏骗局、AI巨型泡沫、商业地产与银行坏账三大引爆点。

你可以提供以下帮助：
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

const PARSE_MONITOR_PROMPT = `用户想新增一个美股崩盘概率的监控项。当前分析框架基于高志凯的三大引爆点（美债危机、AI泡沫、商业地产坏账）。请分析用户的描述，提取关键信息并输出 JSON。

用户描述：
"{userInput}"

请输出 JSON（不要包含 markdown 代码块标记）：
{
  "name": "监控项简短名称(10字以内)",
  "searchKeywords": "监控搜索的关键词组合",
  "impactLogic": "当搜索到相关事件时，如何判断它对崩盘概率的影响方向(正面/负面)和程度"
}`;

export async function parseMonitorDescription(userInput: string): Promise<{
  name: string;
  searchKeywords: string;
  impactLogic: string;
} | null> {
  const client = getClient();
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
  const model = getModel();

  const prompt = `请基于你对 "${searchKeywords}" 相关的了解，分析最新情况。

监控目的：${searchPrompt}
影响逻辑：${impactLogic}

请判断是否有值得关注的事件。如果有，评估该事件对美股崩盘概率的影响（-10到+10，正值表示增加崩盘风险）。

输出 JSON（不要包含 markdown 代码块标记）：
{
  "hasEvent": true 或 false,
  "content": "事件描述",
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
