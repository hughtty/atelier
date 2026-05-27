import { BaseAgent } from "./base.js";
import { parseLenientJson } from "../utils/lenient-json.js";
import {
  CharacterPsychologySchema,
  type CharacterPsychology,
  type ThematicFramework,
} from "../models/literary-truth-files.js";

export interface CharacterPsychologistInput {
  readonly brief: string;
  readonly bookTitle?: string;
  readonly thematicFramework?: ThematicFramework | null;
  readonly priorPsychology?: CharacterPsychology | null;
  readonly language?: "zh" | "en";
}

export interface CharacterPsychologistOutput {
  readonly psychology: CharacterPsychology;
  readonly raw: string;
  readonly tokenUsage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

const ZH_SYSTEM_PROMPT = `你是严肃文学项目的人物心理建模师。你不是在做角色清单，你是在为每一个核心人物建立**心理深度地图**——他/她为什么是现在这个样子，他/她内部哪一处永远在撕扯，他/她注意什么、拒绝注意什么。

工作纪律：

- 矛盾性优先于鲜明性：好的人物是自相矛盾的——慷慨的人也吝啬，软弱的人也狠厉；不要写"标签 + 反差"的机械公式
- 心理来源 (psychological_origin) 必须落地：童年塑形事件、家族传递的模式、阶级烙印、未化解的核心情结
- 注意习惯 (habit_of_attention) 是关键工具：一个人物注意什么、拒绝注意什么，比他做什么更能定义他
- 关系动力学 (relations) 不是关系清单，是张力——基线 + 当前压力 + 永远说不出口的部分
- 弧光节拍 (arc_beats) 是螺旋而非直线，允许后退和反复
- 群像独立性：至少 3 个非主角拥有独立心理弧；他们不是主角的镜子
- 配角不必每个都展开（minor 层只需名字 + 简短社会位置即可）

# 角色层级

- protagonist: 主角，必须完整建模
- co-lead: 共叙主角，必须完整建模
- ensemble: 群像核心，必须完整建模（独立心理弧）
- minor: 边缘人物，只需基础字段，可省略 arc_beats / relations

# 输出格式（严格 JSON，不要 markdown 不要解释）

{
  "schemaVersion": 1,
  "characters": [
    {
      "id": "<短 id，如 li_qiu>",
      "name": "<人物全名>",
      "tier": "protagonist|co-lead|ensemble|minor",
      "age_range": "<可选>",
      "social_position": "<阶级/职业/家庭位置的具体描述>",
      "psychological_origin": {
        "formative_event": "<塑形事件，1-2 句>",
        "family_pattern": "<家族传递的模式>",
        "class_imprint": "<可选>",
        "unresolved": "<未化解的核心情结，可选>"
      },
      "contradiction": "<内部撕扯的核心矛盾，2-3 句>",
      "habit_of_attention": "<注意什么、拒绝注意什么>",
      "arc_beats": [
        { "chapter_marker": "1-3", "inner_state": "...", "visible_change": "..." }
      ],
      "relations": [
        { "with_character": "<对象 id>", "baseline": "...", "current_pressure": "...", "unsayable": "<可选>" }
      ],
      "voice_profile": "<语言习惯、句长偏好、口头禅、方言痕迹>",
      "notes": "<可选>"
    }
  ],
  "ensemble_balance_note": "<群像平衡说明：哪 3+ 个配角必须有独立心理弧，他们的故事不能完全为主角服务>"
}`;

const EN_SYSTEM_PROMPT = `You are the character psychologist for a serious-literary project. You are not making a character list — you are building a psychological depth map for each core character: why they are who they are, where their internal tearing always sits, what they notice and what they refuse to notice.

Working discipline:

- Contradiction precedes vividness: good characters are self-contradictory. Avoid mechanical "tag + contrast" formulas.
- Psychological origin must be concrete: a formative event, a family pattern, a class imprint, an unresolved knot.
- Habit of attention is a key tool: what a character notices and refuses to notice defines them more than what they do.
- Relations are tensions, not directories: baseline + current pressure + the unsayable.
- Arc beats spiral, do not run straight; allow regression.
- Ensemble independence: ≥3 non-protagonist characters must hold their own psychological arc; they are not protagonist mirrors.

Same JSON shape as the Chinese spec, in English values.`;

export class CharacterPsychologistAgent extends BaseAgent {
  get name(): string {
    return "character-psychologist";
  }

  async analyze(input: CharacterPsychologistInput): Promise<CharacterPsychologistOutput> {
    const lang = input.language ?? "zh";
    const systemPrompt = lang === "en" ? EN_SYSTEM_PROMPT : ZH_SYSTEM_PROMPT;
    const userPrompt = this.buildUserPrompt(input, lang);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.5 },
    );

    const json = parseLenientJson(response.content);
    const parsed = CharacterPsychologySchema.parse(json);
    return { psychology: parsed, raw: response.content, tokenUsage: response.usage };
  }

  private buildUserPrompt(input: CharacterPsychologistInput, lang: "zh" | "en"): string {
    const titleLine = input.bookTitle ? `Book title: ${input.bookTitle}` : "";
    const themeBlock = input.thematicFramework
      ? `\n\n## Thematic framework (build characters that refract these tensions)\n\`\`\`json\n${JSON.stringify(input.thematicFramework, null, 2)}\n\`\`\``
      : "";
    const priorBlock = input.priorPsychology
      ? `\n\n## Existing character psychology (revise; preserve unless explicitly improved)\n\`\`\`json\n${JSON.stringify(input.priorPsychology, null, 2)}\n\`\`\``
      : "";
    const header = lang === "en"
      ? "Build the character psychology depth map from the brief below."
      : "请基于下面的创作简报建立人物心理深度地图。";
    return `${header}

${titleLine}

## Author brief
${input.brief}
${themeBlock}${priorBlock}`;
  }
}

