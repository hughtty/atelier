/**
 * EditorialAuditor — Atelier's literary audit layer.
 *
 * Composes three sources of issues into one merged audit result:
 *  1. ContinuityAuditor result (LLM) — passed in by caller, optional
 *  2. analyzeAITells (rule-based, 9 literary-tuned dimensions) — run inline
 *  3. Literary-dimensions evaluation (LLM, 10 serious-literary dimensions) — run inline
 *
 * Why the caller supplies (1) instead of us running it: ContinuityAuditor has
 * a richer signature (book dir, rule stack, context package) that the
 * pipeline already constructs. We accept its output and add the literary
 * layers on top.
 */

import { BaseAgent } from "./base.js";
import type { AuditResult, AuditIssue } from "./continuity.js";
import { analyzeAITells } from "./ai-tells.js";
import type { ChapterMeta } from "../models/chapter.js";
import type { BookConfig } from "../models/book.js";
import type { ThematicFramework, SymbolicNetwork, CharacterPsychology } from "../models/literary-truth-files.js";

// 10 literary dimensions evaluated by an LLM call. Numbered 30-39 to avoid
// collision with continuity (1-27) and ai-tells (20-28).
const LITERARY_DIMENSIONS: ReadonlyArray<{ readonly id: number; readonly label_zh: string; readonly label_en: string; readonly criterion_zh: string; readonly criterion_en: string }> = [
  { id: 30, label_zh: "主题一致性", label_en: "Theme Consistency",
    criterion_zh: "本章是否对核心命题做了一次正面或反面的折射？折射是否含蓄（不是字面回响）？是否避免了把主题写成议论？",
    criterion_en: "Does this chapter refract the core proposition (positively or negatively) tacitly, without literal echo or essayistic commentary?" },
  { id: 31, label_zh: "心理深度", label_en: "Psychological Depth",
    criterion_zh: "人物行为是否可追溯到他们的过往经历、家族传递或阶级烙印？是否避免了为剧情方便让人物突然意识到未知的真相？",
    criterion_en: "Do character actions trace back to formative origins / family pattern / class imprint, without convenient self-realization?" },
  { id: 32, label_zh: "矛盾性优先", label_en: "Contradiction Over Vividness",
    criterion_zh: "人物是否展现了真实的内部撕扯（慷慨的人也吝啬之类）？是否避免了机械的「标签 + 反差细节」公式？",
    criterion_en: "Do characters show genuine internal contradiction, not mechanical 'tag + contrast' formulas?" },
  { id: 33, label_zh: "群像独立性", label_en: "Ensemble Independence",
    criterion_zh: "本章出场的配角是否表现出独立的关切（不只服务于主角）？他们是否像在过自己的日子？",
    criterion_en: "Do supporting characters display concerns independent of the protagonist? Do they read as having their own lives?" },
  { id: 34, label_zh: "意象网络", label_en: "Image Network",
    criterion_zh: "本章使用的意象是否承担了主题折射？同一意象是否避免了连续渲染（>2 次）？意象是否在 seeded/echoed/transformed/silent 的状态机里推进？",
    criterion_en: "Do images this chapter carry thematic refraction? Is consecutive same-image rendering (>2x) avoided? Are images progressing through seeded/echoed/transformed/silent states?" },
  { id: 35, label_zh: "留白与克制", label_en: "Restraint and Omission",
    criterion_zh: "本章是否有至少一处主动省略（关键事件不直写，让读者从前后侧面拼出）？是否避免了过度解释、上帝视角的总结？",
    criterion_en: "Is there at least one deliberate omission (a key moment left unwritten, reconstructed by surrounding angles)? Is over-explanation and god-view summary avoided?" },
  { id: 36, label_zh: "节奏呼吸", label_en: "Narrative Breathing",
    criterion_zh: "紧张段与松弛段是否交替？章中是否有可辨识的换气处？情绪曲线是否清晰？",
    criterion_en: "Do tense and slack passages alternate? Is there a discernible breathing point in the chapter? Is the emotional arc clear?" },
  { id: 37, label_zh: "对话潜台词", label_en: "Dialogue Subtext",
    criterion_zh: "本章对话是否带潜台词（表层 A、里层 B）？是否避免了一句对话不带潜台词就能被完全读懂？",
    criterion_en: "Do dialogues carry subtext (surface A, depth B)? Is the lazy 'fully readable without subtext' style avoided?" },
  { id: 38, label_zh: "感官具体性", label_en: "Sensory Specificity",
    criterion_zh: "本章是否在视觉之外嵌入听/嗅/触/味中至少一项？具体名词（劳动、物件、地点）是否压过抽象情绪词？",
    criterion_en: "Beyond the visual, does the chapter embed at least one of hear/smell/touch/taste? Do concrete nouns (labor, objects, places) outweigh abstract emotional words?" },
  { id: 39, label_zh: "结局承认丧失", label_en: "Ending Acknowledges Loss",
    criterion_zh: "若本章是阶段性收束，是否让读者闻到代价？是否避免了圆满的、无代价的胜利？",
    criterion_en: "If this chapter is a stage-end, does the reader smell the cost? Is a costless tidy victory avoided?" },
];

export interface EditorialAuditInput {
  readonly book: BookConfig;
  readonly chapter: ChapterMeta;
  readonly chapterContent: string;
  readonly thematicFramework?: ThematicFramework | null;
  readonly characterPsychology?: CharacterPsychology | null;
  readonly symbolicNetwork?: SymbolicNetwork | null;
  readonly continuityResult?: AuditResult; // pre-computed continuity result, optional
  readonly priorChapterSummary?: string;
}

export interface EditorialAuditResult extends AuditResult {
  readonly literaryIssues: ReadonlyArray<AuditIssue>;
  readonly aiTellIssues: ReadonlyArray<AuditIssue>;
  readonly continuityIssues: ReadonlyArray<AuditIssue>;
}

export class EditorialAuditor extends BaseAgent {
  get name(): string {
    return "editorial-auditor";
  }

  async audit(input: EditorialAuditInput): Promise<EditorialAuditResult> {
    const language = (input.book.language ?? "zh") as "zh" | "en";

    // Layer 1: continuity result (passed in by caller, may be empty)
    const continuityIssues = input.continuityResult?.issues ?? [];

    // Layer 2: ai-tells (rule-based)
    const aiTellRaw = analyzeAITells(input.chapterContent, language);
    const aiTellIssues: AuditIssue[] = aiTellRaw.issues.map((i) => ({
      severity: i.severity === "warning" ? "warning" : "info",
      category: `[anti-AI] ${i.category}`,
      description: i.description,
      suggestion: i.suggestion,
    }));

    // Layer 3: literary dimensions (LLM)
    const literaryIssues = await this.evaluateLiteraryDimensions(input, language);

    const allIssues: AuditIssue[] = [
      ...continuityIssues,
      ...literaryIssues,
      ...aiTellIssues,
    ];
    const hasCritical = allIssues.some((i) => i.severity === "critical");
    const summary = `Editorial audit: ${continuityIssues.length} continuity, ${literaryIssues.length} literary, ${aiTellIssues.length} anti-AI-trace issues. ${hasCritical ? "Has critical issues." : "No critical issues."}`;

    return {
      passed: !hasCritical,
      issues: allIssues,
      summary,
      overallScore: input.continuityResult?.overallScore,
      tokenUsage: input.continuityResult?.tokenUsage,
      continuityIssues,
      literaryIssues,
      aiTellIssues,
    };
  }

  private async evaluateLiteraryDimensions(
    input: EditorialAuditInput,
    language: "zh" | "en",
  ): Promise<ReadonlyArray<AuditIssue>> {
    const isEnglish = language === "en";
    const dimensionsBlock = LITERARY_DIMENSIONS
      .map((d) => `${d.id}. ${isEnglish ? d.label_en : d.label_zh}: ${isEnglish ? d.criterion_en : d.criterion_zh}`)
      .join("\n");

    const themeBlock = input.thematicFramework
      ? `\n\n## Thematic framework\n\`\`\`json\n${JSON.stringify(input.thematicFramework, null, 2)}\n\`\`\``
      : "";
    const charBlock = input.characterPsychology
      ? `\n\n## Character psychology (compact)\n${input.characterPsychology.characters.slice(0, 5).map((c) => `- ${c.name} (${c.tier}): ${c.contradiction}`).join("\n")}`
      : "";
    const imageBlock = input.symbolicNetwork
      ? `\n\n## Symbolic network (compact)\n${input.symbolicNetwork.core_images.slice(0, 8).map((i) => `- ${i.image} (${i.domain}, state: ${i.current_state}): ${i.thematic_link}`).join("\n")}`
      : "";

    const systemPrompt = isEnglish
      ? `You are a serious-literary editorial auditor. Evaluate the chapter against ${LITERARY_DIMENSIONS.length} literary dimensions. Be strict but specific — every issue must point to a concrete passage or pattern. Do not flag dimensions that pass.

Dimensions:
${dimensionsBlock}

Output strict JSON, an array of issue objects. Empty array if all dimensions pass.

[
  { "dim": <id>, "severity": "critical|warning|info", "category": "<dim label>", "description": "<concrete observation>", "suggestion": "<what to change>" }
]`
      : `你是严肃文学的编辑审稿人。请按以下 ${LITERARY_DIMENSIONS.length} 个文学维度评估本章。要严格但具体——每一条问题必须指向章节中具体的段落或模式。通过的维度不要列出。

维度：
${dimensionsBlock}

输出严格 JSON，是 issue 对象的数组。如果所有维度都通过，输出空数组。

[
  { "dim": <id>, "severity": "critical|warning|info", "category": "<维度名>", "description": "<具体观察>", "suggestion": "<修改建议>" }
]`;

    const userPrompt = `## Chapter ${input.chapter.number} — ${input.chapter.title ?? ""}

${input.chapterContent}
${themeBlock}${charBlock}${imageBlock}`;

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3 },
    );

    const issues = parseLiteraryIssues(response.content);
    return issues;
  }
}

function parseLiteraryIssues(raw: string): AuditIssue[] {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const firstBracket = body.indexOf("[");
  const lastBracket = body.lastIndexOf("]");
  if (firstBracket < 0 || lastBracket < 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(firstBracket, lastBracket + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: AuditIssue[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const sev = e.severity === "critical" || e.severity === "warning" || e.severity === "info"
      ? e.severity
      : "warning";
    const category = typeof e.category === "string" && e.category ? e.category : "literary";
    const description = typeof e.description === "string" ? e.description : "";
    const suggestion = typeof e.suggestion === "string" ? e.suggestion : "";
    if (!description) continue;
    out.push({ severity: sev, category: `[literary] ${category}`, description, suggestion });
  }
  return out;
}
