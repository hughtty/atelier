import { BaseAgent } from "./base.js";
import { ThematicFrameworkSchema, type ThematicFramework } from "../models/literary-truth-files.js";
import { parseLenientJson } from "../utils/lenient-json.js";

export interface ThematicAnalystInput {
  readonly brief: string;
  readonly bookTitle?: string;
  readonly genreId?: string;
  readonly priorFramework?: ThematicFramework | null;
  readonly language?: "zh" | "en";
}

export interface ThematicAnalystOutput {
  readonly framework: ThematicFramework;
  readonly raw: string;
  readonly tokenUsage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

const ZH_SYSTEM_PROMPT = `你是严肃文学项目的主题分析师。你的工作是基于作者提供的创作简报，提炼出本作的"主题骨架"——核心命题、价值张力、变奏路线、结局姿态。

工作纪律：

- 主题不是装饰，是这本书的脊梁。它必须可以被一句话讲清楚，但又不能被这句话穷尽
- 不要套用现成的"主题词表"——避免"成长""救赎""孤独"这种笼统标签；写下与这部具体作品贴肤的命题
- 价值张力 (value tensions) 必须是真实的两难：A 不是错的，B 也不是错的；它们是同一个世界里两种都站得住脚的位置
- 变奏 (thematic variations) 不是同一意思的重复，是同一命题在不同人物/不同处境下的不同折射
- 结局姿态 (ending posture) 必须承认丧失——严肃文学的结局不庆祝胜利
- 禁忌解 (forbidden resolutions) 必须列出三种以上读者会期待但作品必须拒绝的简化解决方案

# 输出格式（严格 JSON，不要 markdown 不要解释）

{
  "schemaVersion": 1,
  "core_proposition": "<一句话核心命题>",
  "thematic_question": "<引发命题的具体问题，1-2 句>",
  "value_tensions": [
    { "pole_a": "...", "pole_b": "...", "description": "<两极各自的合法性 + 内在冲突，2-3 句>" }
  ],
  "thematic_variations": [
    { "chapter_range": "1-3", "perspective": "<通过谁/什么折射>", "refraction": "<这一段折射出主题的哪一面>" }
  ],
  "ending_posture": "<结局承认什么丧失>",
  "forbidden_resolutions": ["<必须避免的简化解 1>", "<2>", "<3>"],
  "notes": "<可选：进一步说明>"
}`;

const EN_SYSTEM_PROMPT = `You are the thematic analyst for a serious-literary project. Your job is to distill the author's brief into the "thematic skeleton" of the work — its core proposition, value tensions, variation roadmap, and ending posture.

Working discipline:

- Theme is not decoration but the spine of the book. It must be statable in one sentence but never exhausted by that sentence.
- Avoid generic theme labels ("coming-of-age", "redemption", "loneliness"); name a proposition that hugs this specific work.
- Value tensions must be genuine dilemmas: A is not wrong, B is not wrong; they are two legitimate positions in the same world.
- Thematic variations are not repetition; they are different refractions of the same proposition through different characters and situations.
- Ending posture must acknowledge loss — serious-literary endings do not celebrate victory.
- Forbidden resolutions must list three or more simplifying outcomes the reader will expect but the work must refuse.

# Output format (strict JSON, no markdown, no explanation)

Same shape as the Chinese spec but in English values.`;

export class ThematicAnalystAgent extends BaseAgent {
  get name(): string {
    return "thematic-analyst";
  }

  async analyze(input: ThematicAnalystInput): Promise<ThematicAnalystOutput> {
    const lang = input.language ?? "zh";
    const systemPrompt = lang === "en" ? EN_SYSTEM_PROMPT : ZH_SYSTEM_PROMPT;
    const userPrompt = this.buildUserPrompt(input, lang);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.4 },
    );

    const json = parseLenientJson(response.content);
    const parsed = ThematicFrameworkSchema.parse(json);
    return { framework: parsed, raw: response.content, tokenUsage: response.usage };
  }

  private buildUserPrompt(input: ThematicAnalystInput, lang: "zh" | "en"): string {
    const titleLine = input.bookTitle ? `Book title: ${input.bookTitle}` : "";
    const genreLine = input.genreId ? `Genre: ${input.genreId}` : "";
    const priorBlock = input.priorFramework
      ? `\n\n## Existing thematic framework (revise; preserve unless explicitly improved)\n\`\`\`json\n${JSON.stringify(input.priorFramework, null, 2)}\n\`\`\``
      : "";
    const header = lang === "en"
      ? "Distill the thematic framework for the brief below."
      : "请基于下面的创作简报，提炼主题骨架。";
    return `${header}

${titleLine}
${genreLine}

## Author brief
${input.brief}
${priorBlock}`;
  }
}

