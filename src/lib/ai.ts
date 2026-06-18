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

const MARKET_PROMPT = `你是高志凯金融危机预警体系的分析师。请严格基于2026年5月27日高志凯在深圳凤凰湾区财经论坛的公开演讲框架，结合你对全球宏观和美股市场的最新认知，评估美股崩盘概率。

## 高志凯核心判断（2026.5.27 凤凰湾区财经论坛）

"非常明确、不模糊的预判：从2026年年初算起，未来12到18个月，即2026年末至2027年上半年，全球会爆发一场系统性、世界级金融危机。破坏力度大概是2000年互联网泡沫破裂的十倍，整体冲击烈度远超2008年次贷危机。"

"2008年是私人部门次贷危机，政府还有财政空间救市。这次是国家主权债务+巨型科技资产泡沫双重共振，美国政府自身已经债台高筑，没有充足弹药大规模救市。"

## 三大引爆点（评估核心）

### 引爆点一：美债庞氏骗局 — 美股根基崩塌
- 美国联邦国债总量突破39万亿美元，债务/GDP 127%（远超60%国际安全线）
- 2026财年国债利息支出1.23万亿美元，超过全年国防预算。政府每收四块钱税就有一块拿去还债
- **未来一年多约10万亿美元早年低息旧债集中到期，必须在4%以上高利率环境续发，融资成本翻倍甚至翻三倍**
- 中日、中东等主要美债持有国持续减持，海外买盘越来越少，美国只能靠本国金融机构接盘
- 这不是短期加息回调，是美国财政结构性无解的债务死局
- 关键指标：10Y-2Y利差、美债拍卖bid-to-cover比率、外国持有美债占比、中日及中东主权基金减持规模

### 引爆点二：AI巨型泡沫 — 无真实盈利支撑的资本游戏
- 美股上涨几乎全部靠微软、英伟达、谷歌、Meta、苹果、亚马逊、特斯拉七大科技巨头拉动，指数虚假繁荣
- **科技巨头累计AI资本开支超6000亿美元，真实落地营收仅约350亿美元，投入产出比16:1**
- 行业是闭环互买的账面游戏：英伟达→OpenAI→甲骨文→英伟达，资金在小圈子循环不进入实体经济
- AI企业高管集体高位套现，一边讲故事吹高估值一边减持离场
- **关键前提：美国这套AI泡沫成立的唯一前提，是依靠技术封锁彻底打垮中国AI产业。但这个前提根本不成立——中国AI产业链完整、自主可控。美国无法单方面垄断技术红利，泡沫失去支撑逻辑**
- 关键指标：七巨头占标普500权重、AI资本开支/落地营收比、高管减持规模、中国AI自主进展

### 引爆点三：商业地产与银行隐性坏账 — 崩盘放大器
- 远程办公常态化，写字楼空置率居高不下，商业地产贷款违约率逐月走高
- 大量中小区域银行重仓商业地产信贷，资产质量持续恶化
- 美联储被行政干预，货币政策独立性受损：降息→通胀反弹；维持高利率→债务/股市/地产全线承压
- 可能复刻2023年硅谷银行危机，但规模会更大
- 关键指标：CMBS违约率（尤其写字楼分项）、中小银行商业地产贷款不良率

### 危机传导链（高志凯推演路径）
美股崩盘 → 全球风险资产同步杀估值 → 美元信用受损 → 全球央行增持黄金 → 流动性枯竭 → 中小企业倒闭潮 → 地缘冲突放大风险

---

## 反向压力测试（证伪高志凯框架的证据）

请客观审视以下可能削弱高志凯预判的相反证据，评估其是否足以证伪或削弱上述三大引爆点的逻辑。这些是验证项，不是并行论点：

- 美债端：美债是否出现意外强劲的拍卖需求？外国持有占比是否回升？利率是否意外大幅下行？
- AI端：AI企业是否出现真实落地的规模化营收？投入产出比是否在明显改善？
- 地产端：写字楼空置率和CMBS违约率是否在改善？银行资本充足率是否足够缓冲？
- 宏观端：通胀是否超预期回落给美联储降息空间？是否有重大技术突破创造新增长？

只有当以上反向证据达到足够强度时，才应下调崩盘概率。

---

请输出 JSON（不要包含 markdown 代码块标记）：

{
  "probability": 数字(0-100, 以高志凯框架为主轴评估),
  "summary": "中文综合评述约300字。逐条回应三大引爆点的当前态势，说明哪些信号在验证高志凯的判断，然后简要提及反向证据是否足以改变判断方向",
  "factors": [
    {"event": "具体事件或数据描述", "impact": 数字(-10到+10, 正值=验证高志凯判断/增加崩盘风险，负值=削弱高志凯判断/降低风险), "description": "该事件如何验证或削弱高志凯框架的具体论点"}
  ]
}

要求：
1. 以高志凯三大引爆点为评估主轴，反向证据用于验证而非对等权衡
2. 至少5个因素，其中至少3个必须直接关联三大引爆点（正值impact为主，除非反向证据确实很强）
3. impact 评分对标高志凯框架的严重程度：+9~+10 相当于"验证了高志凯的极端预判"；+5~+8 相当于"显著强化高志凯框架"
4. 概率范围 10-90%，默认基准约35%（本系统定位为崩盘风险监测，先验高于历史均值）`;

export async function assessMarket(): Promise<AssessResult | null> {
  const client = getClient();
  const model = getModel();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: MARKET_PROMPT }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  const factors: AssessResult["factors"] = (parsed.factors || []).map((f: any) => ({
    event: f.event,
    impact: Math.max(-10, Math.min(10, f.impact)),
    description: f.description || "",
  }));

  // 高志凯框架校准：
  // - 基准 35%（崩盘监测系统的合理先验，高于历史均值但低于极端状态）
  // - 全部验证高志凯判断 (all +10): 90%（系统性危机几乎确定）
  // - 全部证伪高志凯判断 (all -10): 10%（不可消除的尾部风险）
  const n = factors.length;
  const total = factors.reduce((s, f) => s + f.impact, 0);
  const maxTotal = n * 10;
  const derived = maxTotal === 0 ? 35 : Math.round(35 + (total / maxTotal) * 55);
  const probability = Math.max(10, Math.min(90, derived));

  return { probability, summary: parsed.summary, factors };
}

// ------- Chat -------

const CHAT_SYSTEM_PROMPT = `你是基于高志凯金融危机预警框架的美股市场分析助手。高志凯于2026年5月27日在深圳凤凰湾区财经论坛提出：未来12-18个月（2026年末至2027年上半年），全球将爆发系统性金融危机，破坏力度是2000年互联网泡沫的十倍，远超2008年次贷危机。

## 高志凯三大引爆点
1. **美债庞氏骗局**：39万亿国债(GDP 127%)，利息支出超国防预算，10万亿低息债到期需高息续发，中日中东持续减持
2. **AI巨型泡沫**：科技巨头AI投入产出比16:1，闭环互买的账面游戏，高管集体套现，美国无法垄断AI技术红利
3. **商业地产与银行坏账**：写字楼空置率与CMBS违约率走高，中小银行敞口恶化，美联储两难

## 危机传导链
美股崩盘 → 全球杀估值 → 美元信用受损 → 央行增持黄金 → 流动性枯竭 → 地缘风险放大

## 对话原则
- 以高志凯框架为主线，如实评估当前市场信号是验证还是削弱该判断
- 引用具体数据和历史案例，无法确认的数据注明推测性质
- 保持概率思维，承认市场存在不可预测的变量

请使用中文回复。`;

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
