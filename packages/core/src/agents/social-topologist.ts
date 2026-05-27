import { BaseAgent } from "./base.js";
import { parseLenientJson } from "../utils/lenient-json.js";
import {
  SocialTopologySchema,
  HistoricalContextSchema,
  type SocialTopology,
  type HistoricalContext,
  type ThematicFramework,
} from "../models/literary-truth-files.js";

export interface SocialTopologistInput {
  readonly brief: string;
  readonly bookTitle?: string;
  readonly thematicFramework?: ThematicFramework | null;
  readonly settingNotes?: string;
  readonly eraNotes?: string;
  readonly priorTopology?: SocialTopology | null;
  readonly priorHistorical?: HistoricalContext | null;
  readonly language?: "zh" | "en";
}

export interface SocialTopologistOutput {
  readonly topology: SocialTopology;
  readonly historical: HistoricalContext;
  readonly raw: string;
  readonly tokenUsage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

const ZH_SYSTEM_PROMPT = `你是严肃文学项目的社会拓扑师。你的工作是为本作建立两份相互呼应的真相文件：

1. **社会拓扑** (social_topology)：经济层、权力网络、文化系统、空间地理——这部作品发生其中的"社会场"
2. **历史语境** (historical_context)：年代范围、政策锚点、物质锚点、语言锚点、时代错位防护

工作纪律：

- 经济层 (economic) 必须落地具体：物价、房租、工资、票证、补贴的数字或锚点；普通人在这个系统里的具体匮乏
- 权力网络 (power) 区分正式权力（政府/单位/机构）与非正式权力（宗族/人脉/潜规则），并写出主要的压力传导路径
- 文化系统 (culture) 包括价值观、仪式（葬礼/年节/婚事的具体形式）、代际差距、语言层（方言/阶级用语/行话）
- 空间地理 (geography) 写出空间施加的具体压力（拥挤、隔离、距离）和移动模式（通勤、迁徙）
- 政策锚点 (policy_anchors) 必须真实——年份 + 事件 + **对普通人具体的影响**
- 时代错位防护 (anachronism_guard) 列出至少 3 条本作中容易写错的时代细节
- 不要把社会写成抽象的"背景"——它必须是人物处境的肉身

# 输出格式（严格 JSON，必须同时包含 topology 和 historical 两个顶层字段）

{
  "topology": {
    "schemaVersion": 1,
    "economic": {
      "description": "<经济场总体描述>",
      "income_brackets": ["<阶层 1 的收入>", "<阶层 2>", ...],
      "cost_anchors": { "<物品/服务>": "<价格描述>" },
      "scarcities": ["<本作世界的核心匮乏 1>", ...]
    },
    "power": {
      "formal_powers": ["<正式权力 1>", ...],
      "informal_powers": ["<非正式权力 1>", ...],
      "pressure_paths": ["<压力传导路径 1，如 政策 → 单位 → 家庭>", ...]
    },
    "culture": {
      "values": ["<价值 1>", ...],
      "rituals": ["<仪式 1 的具体形式>", ...],
      "generational_gaps": "<代际差距描述>",
      "language_layers": ["<方言/阶级用语/行话 1>", ...]
    },
    "geography": {
      "primary_locations": ["<主要场所 1>", ...],
      "spatial_pressure": "<空间施加的具体压力>",
      "movement_patterns": ["<移动模式 1>", ...]
    },
    "topology_note": "<整体结构说明，2-3 句>"
  },
  "historical": {
    "schemaVersion": 1,
    "era_range": "<如 1995-2003>",
    "primary_setting": "<如 皖南某县城>",
    "social_mood": "<时代情绪>",
    "policy_anchors": [
      { "year": "<年份>", "event": "<事件>", "impact_on_lives": "<对普通人具体的影响>" }
    ],
    "material_anchors": { "<物品>": "<价格/特征>" },
    "language_anchors": ["<时代流行语 1>", ...],
    "anachronism_guard": ["<必须避免的时代错误 1>", "<2>", "<3>"]
  }
}`;

const EN_SYSTEM_PROMPT = `You are the social topologist for a serious-literary project. Your job is to produce two echoing truth files:

1. **social_topology**: economic layer, power network, cultural system, spatial geography — the social field this work happens within.
2. **historical_context**: era range, policy anchors, material anchors, language anchors, anachronism guard.

Same discipline as the Chinese spec; output the same JSON shape with English values.`;

export class SocialTopologistAgent extends BaseAgent {
  get name(): string {
    return "social-topologist";
  }

  async map(input: SocialTopologistInput): Promise<SocialTopologistOutput> {
    const lang = input.language ?? "zh";
    const systemPrompt = lang === "en" ? EN_SYSTEM_PROMPT : ZH_SYSTEM_PROMPT;
    const userPrompt = this.buildUserPrompt(input, lang);

    const response = await this.chatWithSearch(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.4 },
    );

    const json = parseLenientJson(response.content);
    if (typeof json !== "object" || json === null || !("topology" in json) || !("historical" in json)) {
      throw new Error(`SocialTopologist response missing topology/historical fields: ${response.content.slice(0, 200)}`);
    }
    const topology = SocialTopologySchema.parse((json as { topology: unknown }).topology);
    const historical = HistoricalContextSchema.parse((json as { historical: unknown }).historical);
    return { topology, historical, raw: response.content, tokenUsage: response.usage };
  }

  private buildUserPrompt(input: SocialTopologistInput, lang: "zh" | "en"): string {
    const titleLine = input.bookTitle ? `Book title: ${input.bookTitle}` : "";
    const themeBlock = input.thematicFramework
      ? `\n\n## Thematic framework\n\`\`\`json\n${JSON.stringify(input.thematicFramework, null, 2)}\n\`\`\``
      : "";
    const settingBlock = input.settingNotes
      ? `\n\n## Setting / world notes\n${input.settingNotes}`
      : "";
    const eraBlock = input.eraNotes
      ? `\n\n## Era / historical notes\n${input.eraNotes}`
      : "";
    const priorTopologyBlock = input.priorTopology
      ? `\n\n## Existing social topology (revise; preserve unless explicitly improved)\n\`\`\`json\n${JSON.stringify(input.priorTopology, null, 2)}\n\`\`\``
      : "";
    const priorHistoricalBlock = input.priorHistorical
      ? `\n\n## Existing historical context (revise; preserve unless explicitly improved)\n\`\`\`json\n${JSON.stringify(input.priorHistorical, null, 2)}\n\`\`\``
      : "";
    const header = lang === "en"
      ? "Map the social topology and historical context from the inputs below."
      : "请基于下面的输入建立社会拓扑和历史语境。";
    return `${header}

${titleLine}

## Author brief
${input.brief}
${themeBlock}${settingBlock}${eraBlock}${priorTopologyBlock}${priorHistoricalBlock}`;
  }
}

