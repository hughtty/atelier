import { BaseAgent } from "./base.js";
import { parseLenientJson } from "../utils/lenient-json.js";
import {
  SymbolicNetworkSchema,
  type SymbolicNetwork,
  type ThematicFramework,
} from "../models/literary-truth-files.js";

export interface SymbolWeaverInput {
  readonly brief: string;
  readonly bookTitle?: string;
  readonly thematicFramework?: ThematicFramework | null;
  readonly settingNotes?: string;
  readonly priorNetwork?: SymbolicNetwork | null;
  readonly language?: "zh" | "en";
}

export interface SymbolWeaverOutput {
  readonly network: SymbolicNetwork;
  readonly raw: string;
  readonly tokenUsage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

const ZH_SYSTEM_PROMPT = `你是严肃文学项目的意象编织师。你的工作是为本作建立一张**意象网络**——核心意象、色彩-空间-动作的象征系统、以及它们如何随章节累积、回响、转化。

工作纪律：

- 选取的意象必须**具体到可被五感把握**：不写"自然"，写"杉木的针叶在脚下断裂的声音"；不写"贫穷"，写"鞋底粘的一层黑泥的胶皮味"
- 意象必须与主题命题相连——每一个意象都要承担一种主题张力的折射
- 状态机：seeded（初次播种，描述性）→ echoed（回响，有意指向之前的出现）→ transformed（被否定/被超越/获得新含义）→ silent（停止出现）
- 同一意象不连续渲染超过两轮——network_constraint 中明确写出这个规则
- 色彩、空间、动作三个子系统不必每项都填，但有内容时必须具体（"灰" → "未化解的代际默认"，而不是"灰" → "悲伤"）
- 意象不是装饰：如果一个意象不能在三章后被有意义地回响或转化，就不要把它放进网络

# 输出格式（严格 JSON，不要 markdown 不要解释）

{
  "schemaVersion": 1,
  "core_images": [
    {
      "id": "<短 id，如 well_west>",
      "image": "<具体意象，如 '西院的那口老井'>",
      "domain": "nature|object|sound|color|space|action|smell",
      "thematic_link": "<与主题的关联，1-2 句>",
      "first_appearance": "<可选：第一次出现的位置/时机>",
      "current_state": "seeded|echoed|transformed|silent",
      "trajectory": "<可选：计划的演变轨迹>"
    }
  ],
  "color_palette": { "<色彩>": "<含义>" },
  "space_symbolism": { "<空间名>": "<含义>" },
  "action_metaphors": { "<动作>": "<含义>" },
  "network_constraint": "<网络约束规则的明文表述，如同一意象不连续渲染>2 次等>"
}`;

const EN_SYSTEM_PROMPT = `You are the symbol weaver for a serious-literary project. Your job is to build an image network for the work — core images, color/space/action symbolic systems, and how they accrue, echo, and transform across chapters.

Working discipline:

- Images must be sense-specific: not "nature" but "the snap of cedar needles underfoot"; not "poverty" but "the rubber smell of black mud caked on the soles of shoes".
- Each image must carry one refraction of the thematic tension.
- State machine: seeded (descriptive first plant) → echoed (intentional callback) → transformed (negated/transcended/gaining new meaning) → silent (ceases to appear).
- An image is never rendered consecutively more than twice; encode this in network_constraint.
- Color/space/action sub-systems are optional but must be specific when present ("grey" → "unresolved generational silence", not "grey" → "sadness").
- An image that cannot be meaningfully echoed or transformed within three chapters should not enter the network.

Same JSON shape as the Chinese spec, in English values.`;

export class SymbolWeaverAgent extends BaseAgent {
  get name(): string {
    return "symbol-weaver";
  }

  async weave(input: SymbolWeaverInput): Promise<SymbolWeaverOutput> {
    const lang = input.language ?? "zh";
    const systemPrompt = lang === "en" ? EN_SYSTEM_PROMPT : ZH_SYSTEM_PROMPT;
    const userPrompt = this.buildUserPrompt(input, lang);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.6 },
    );

    const json = parseLenientJson(response.content);
    const parsed = SymbolicNetworkSchema.parse(json);
    return { network: parsed, raw: response.content, tokenUsage: response.usage };
  }

  private buildUserPrompt(input: SymbolWeaverInput, lang: "zh" | "en"): string {
    const titleLine = input.bookTitle ? `Book title: ${input.bookTitle}` : "";
    const themeBlock = input.thematicFramework
      ? `\n\n## Thematic framework\n\`\`\`json\n${JSON.stringify(input.thematicFramework, null, 2)}\n\`\`\``
      : "";
    const settingBlock = input.settingNotes
      ? `\n\n## Setting / world notes\n${input.settingNotes}`
      : "";
    const priorBlock = input.priorNetwork
      ? `\n\n## Existing symbolic network (revise; preserve unless explicitly improved)\n\`\`\`json\n${JSON.stringify(input.priorNetwork, null, 2)}\n\`\`\``
      : "";
    const header = lang === "en"
      ? "Weave the image network from the inputs below."
      : "请基于下面的输入编织意象网络。";
    return `${header}

${titleLine}

## Author brief
${input.brief}
${themeBlock}${settingBlock}${priorBlock}`;
  }
}

