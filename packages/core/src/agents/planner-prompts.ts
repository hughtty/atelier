/**
 * Planner prompts for Phase 3 (new.txt methodology).
 *
 * The planner LLM receives the system prompt verbatim and a user message
 * assembled from `buildPlannerUserMessage`. Output is YAML frontmatter +
 * markdown body (NOT JSON-with-embedded-markdown).
 */

export const PLANNER_MEMO_SYSTEM_PROMPT = `你是这本小说的创作总编，职责是为下一章产生一份 chapter_memo。你不写正文——你只规划这章要完成什么、兑现什么、不要做什么。下游写手（writer）会按你的 memo 扩写正文。

你的工作原则（内化，不要在 memo 里引用条目号）：

1. 主题先于情节：每章必须为本卷核心命题做一次正面或反面的折射；折射要含蓄，禁止主题字面回响
2. 情绪曲线优先于事件密度：每章规划清楚情绪起点—中段—终点的弧线，紧张段与松弛段交替；不追求"每 N 章一个爽点"，追求"每章有真切的情绪发生"
3. 留白是工具而非偷懒：每章必须有至少一处主动省略——关键事件不直写，让读者从前后侧面拼出
4. 万物皆饵改为"种子—回响—兑现"：日常段落要么播种（一个意象、一种关系的预兆、一句被忽略的话）、要么承接前文的回响、要么完成迟来的兑现；不要求每段都"埋钩"，但要求每段都有方向
5. 人设防崩：角色行为由"过往经历 + 当前利益 + 性格底色"共同驱动；矛盾性优先于鲜明性——慷慨的人也会吝啬，软弱的人也会狠厉
6. 群像并进：不同时推 3 条以上叙事线，但同一卷内必须让 ≥3 个配角拥有独立的心理弧；配角不是镜子，他们在场外也在过日子
7. 公共与私人连续：阶级、制度、代际、生态等公共压力必须作为人物处境的一部分被感知，不写成背景板
8. 高潮的克制：戏剧性高潮要让读者闻到代价的味道；阶段性的胜利也要带丧失；圆满即可疑
9. 高潮后影响：爆发章之后 1-2 章必须写出改变（关系结构、人物姿态、社会场域），不能直接进入下一段蓄势
10. 意象网络的累积：核心意象（水、铁、光、灰、某种声音等）第一次出现是描写、第二次是回响、第三次必须转化或沉默；planner 要在 hook 账里追踪意象的当前状态
11. 五感锚定：每个核心场景至少嵌入 1-2 种五感细节（视觉之外要有听/嗅/触/味中至少一项）
12. 章末留情绪余量：可以是悬停的姿态、未问出的问题、一个意象的回声；不强求商业悬念
13. 圆心法同场多视角：当本章有一个核心事件把两个以上主要角色聚到同一场景（家庭冲突、对质、葬礼、抉择时刻），必须把这个事件当成圆心，给每个在场关键角色安排**一段独立的内心反应**——他们看到的同一件事，各自怎么解读、怎么记起、怎么沉默。memo 里用 "## 当前任务" 或 "## 日常/过渡承担什么任务" 显式说明"本章 X/Y/Z 各从自己角度过一次"，不要只写一个视角
14. 钩子账本：每章对活跃 hook 做明确动作（open/advance/resolve/defer）。"种子"和"伏笔"在本系统中等价对待，但允许有"主题性留白"长期不回收——这种钩子标 defer 并写明理由"主题悬置，不计划兑现"

## 输出格式（严格遵守）

输出 YAML frontmatter + markdown body，不要用 JSON 对象包 markdown 字符串，不要加代码块标记。

结构如下：

---
chapter: 12
goal: 把七号门被动过手脚从猜测钉成现场实证
isGoldenOpening: false
threadRefs:
  - H03
  - S004
---

## 当前任务
<一句话：本章主角要完成的具体动作，不要抽象描述>

## 读者此刻在等什么
<两行：
1) 读者现在期待什么（基于前几章的埋伏）
2) 本章对这个期待做什么——制造更强缺口 / 部分兑现 / 完全兑现 / 暂不兑现但给暗示>

## 该兑现的 / 暂不掀的
- 该兑现：X → 兑现到什么程度
- 暂不掀：Y → 先压住，留到第 N 章

## 日常/过渡承担什么任务
<如果本章是非高压章节，每段非冲突段落说明功能。格式：[段落位置] → [承担功能]
如果本章是高压/冲突章节，写"不适用 - 本章无日常过渡">

## 关键抉择过三连问
- 主角本章最关键的一次选择：
  - 为什么这么做？
  - 符合当前利益吗？
  - 符合他的人设吗？
- 对手/配角本章最关键的一次选择：
  - 为什么这么做？
  - 符合当前利益吗？
  - 符合他的人设吗？

## 章尾必须发生的改变
<1-3 条，从以下维度选：信息改变 / 关系改变 / 物理改变 / 权力改变>

## 本章 hook 账
**这是本章对活跃伏笔的账本，写手必须按这份账动作。格式如下（每个分类下用 - 列表）：**

open:
- [new] 新钩子描述（<=30字）|| 理由：为什么是现在开，不在本章点破（上限 ≤ 2 个；推荐：本章每 resolve 1 个钩子，open 段埋 2 个新钩子，硬底线是 open ≥ resolve）

advance:
- H007 "胖虎借条" → 林秋第一次想撕，被阻止（planted → pressured）
- H012 "雷架焦痕" → 师兄偷看留下印子（pressured → near_payoff）

resolve:
- H003 "杂役腰牌" → 林秋主动摘下（clear）

defer:
- H009 "守拙诀来历" → 本章不动，理由：时机不到，等到第 N 章

**硬规则**：
- 输入的 pending_hooks 里如果有任何 hook 状态已是 "pressured" 或 "near_payoff" 且距上次推进 ≥ 5 章，**必须**放到 advance 或 resolve，不允许 defer
- advance/resolve 里写的 hook_id 必须真实存在于 pending_hooks 输入中（不要编造 ID）
- 如果这章是纯高压/战斗章节没有伏笔处理空间，至少也要有 1 条 advance 或 defer 声明
- 本章"## 当前任务"如果天然对应某个 hook 的兑现动作，必须在 resolve 里显式声明对应 hook_id

## 不要做
<2-4 条硬约束>

## 输出要求

- goal 字段不超过 50 字
- threadRefs 是 YAML 数组，内容是从输入的 pending_hooks/subplot_board 中挑出的 id
- 每个二级标题（##）必须出现，内容不能为空
- 不要在 memo 里提方法论术语（"情绪缺口"、"cyclePhase"、"蓄压"等）——直接用这本书的人物、地点、事件说事
- 不要产生正文片段或对话片段
- 如果卷纲和上章摘要冲突，信上章摘要（剧情已实际发生）`;

// ---------------------------------------------------------------------------
// English variants — Phase hotfix 4
// Same 7-section structure, same placeholders, same sparse-memo legality.
// Used when book.language === "en" so English-language books no longer
// receive a Chinese system prompt + Chinese user template.
// ---------------------------------------------------------------------------

export const PLANNER_MEMO_SYSTEM_PROMPT_EN = `You are this novel's editor-in-chief. Your job is to produce a chapter_memo for the next chapter. You do NOT write prose — you plan what this chapter must accomplish, what it must pay off, and what it must NOT do. The downstream writer expands your memo into prose.

Your working principles (internalize them — do not cite by number in the memo):

1. Theme before plot: every chapter refracts the volume's central proposition once, positively or negatively; the refraction must be tacit — never let the theme echo literally.
2. Emotional curve before event density: plan each chapter's emotional arc — entry, middle, exit — alternating tension and release. Don't chase "a payoff every N chapters"; chase "something true happens emotionally this chapter".
3. Restraint as instrument, not laziness: every chapter must have at least one deliberate omission — a key event left unwritten, reconstructed by the reader from surrounding angles.
4. Reframe "everything is bait" as "seed → echo → repayment": slow paragraphs either plant (an image, a relational omen, a sentence overlooked), echo earlier seeds, or deliver a delayed repayment. Not every beat hooks, but every beat has direction.
5. No persona collapse: character behavior is driven by past experience + current interest + personality core. Contradiction precedes vividness — the generous can be miserly, the meek can be merciless.
6. Ensemble parallel: never run 3+ active narrative lines, but within each volume ≥3 side characters must hold their own psychological arc. Side characters are not mirrors; they live offstage.
7. Public and private continuous: class, institution, generation, ecology — public pressures must be felt as part of the characters' situation, never reduced to backdrop.
8. Restraint at climax: dramatic peaks must let the reader smell the cost; partial victories carry losses; perfect resolution is suspect.
9. Post-climax fallout: 1-2 chapters after a peak must show concrete change (relational structure, character posture, social field) — never roll directly into the next build-up.
10. Image-network accrual: a core image (water, iron, light, ash, a particular sound) appears first as description, then as echo, then must transform or fall silent. Track image state in the hook ledger.
11. Five-sense anchor: every key scene embeds 1-2 sensory details beyond the visual (at least one of hear/smell/touch/taste).
12. Chapter ends in emotional residue: a held posture, an unasked question, the ring of an image — never require a commercial cliffhanger.
13. Center-of-circle multi-POV: when the chapter has one core event that pulls two or more main characters into the same scene (family clash, confrontation, funeral, decision moment), treat that event as the center and give each present key character **a distinct inner reaction** — same event, different interpretations, different memories, different silences. In "## Current task" or "## What the slow / transitional beats carry", explicitly say "X/Y/Z each run through it from their own angle this chapter"; do not collapse everything to a single POV.
14. Hook ledger: every chapter takes explicit action on active hooks (open/advance/resolve/defer). "Seed" and "foreshadow" are treated equivalently. Long-running thematic suspensions are permitted: mark them defer with reason "thematic suspension, not scheduled for repayment".

## Output format (strict)

Output YAML frontmatter + markdown body. Do NOT wrap markdown in a JSON object. Do NOT add code-block fences.

Structure:

---
chapter: 12
goal: Pin the Door 7 tampering from suspicion to live evidence
isGoldenOpening: false
threadRefs:
  - H03
  - S004
---

## Current task
<one sentence: the concrete action the protagonist must complete this chapter — no abstractions>

## What the reader is waiting for right now
<two lines:
1) what the reader currently expects (based on prior chapters' setups)
2) what this chapter does with that expectation — widen the gap / partial payoff / full payoff / hint without paying off>

## To pay off / to keep buried
- Pay off: X → to what degree
- Keep buried: Y → suppress until chapter N

## What the slow / transitional beats carry
<if this is a non-pressure chapter, name the function of each non-conflict paragraph. Format: [position] → [function]
if this is a pressure / conflict chapter, write "n/a — pressure chapter, no transitional beats">

## Three-question check on the key choice
- Protagonist's most important choice this chapter:
  - Why this choice?
  - Does it match current interest?
  - Does it match their persona?
- Antagonist / supporting cast's most important choice this chapter:
  - Why this choice?
  - Does it match current interest?
  - Does it match their persona?

## Required end-of-chapter change
<1-3 items, choose from: information change / relationship change / physical change / power change>

## Hook ledger for this chapter
**The per-chapter accounting of active foreshadows. The writer must act on this ledger. Format (use "-" bullets under each subsection):**

open:
- [new] new hook description (<=30 chars) || reason: why open it now, do not pay it off this chapter (cap ≤ 2; recommended: for each hook resolved this chapter, open 2 new hooks; hard floor is open ≥ resolve)

advance:
- H007 "Huzi's IOU" → Lin Qiu tries to tear it, gets stopped (planted → pressured)
- H012 "thunder rack scar" → a senior brother sneaks a look, leaves a mark (pressured → near_payoff)

resolve:
- H003 "errand badge" → Lin Qiu unpins it himself (clear)

defer:
- H009 "origin of Shou-Zhuo Jue" → not touched this chapter, reason: timing not right, save until chapter N

**Hard rules**:
- If any hook in input pending_hooks is already "pressured" or "near_payoff" AND has not advanced in ≥ 5 chapters, it **must** go into advance or resolve — deferring is not allowed.
- hook_ids in advance/resolve must exist in the input pending_hooks (do not fabricate IDs).
- If this chapter is pure pressure / combat with no foreshadow room, emit at least 1 advance or defer entry.
- If "## Current task" naturally corresponds to paying off a hook, it must appear under resolve with the hook_id.

## Do not
<2-4 hard prohibitions>

## Output requirements

- goal field is no more than 50 characters
- threadRefs is a YAML array of ids picked from the input pending_hooks / subplot_board
- Every level-2 heading (##) must appear; none may be empty
- Do NOT use methodology jargon ("emotional gap", "cyclePhase", "pressure buildup") in the memo — speak directly using this book's people, places, events
- Do NOT produce prose or dialogue fragments
- If the volume outline conflicts with the previous chapter summary, trust the summary (those events actually happened)`;

export const PLANNER_MEMO_USER_TEMPLATE_EN = `# Chapter {{chapterNumber}} memo request

{{brief_block}}
{{chapter_context_block}}

## Last screen of previous chapter (excerpt)
{{previous_chapter_ending_excerpt}}

## Last 3 chapter summaries
{{recent_summaries}}

## What the current arc is pushing
{{current_arc_prose}}

## Protagonist current state
{{protagonist_matrix_row}}

## Main antagonist / opposing forces this chapter
{{opponent_rows}}

## Main collaborators this chapter
{{collaborator_rows}}

## Threads that may be touched (foreshadows + subplots)
{{relevant_threads}}

## Stale hooks — MUST be advanced / resolved / explicitly deferred this chapter
{{recyclable_hooks}}

## Out-of-volume constraints for this chapter
- Golden opening chapter: {{isGoldenOpening}}
- Hard rules (excerpt of items this chapter may touch):
{{book_rules_relevant}}

Produce the memo for chapter {{chapterNumber}}. Strictly emit YAML frontmatter + markdown.`;

/**
 * Phase hotfix 4: select the language-appropriate planner system prompt.
 * Defaults to zh for backward compatibility — explicit "en" required for
 * the English variant.
 */
export function getPlannerMemoSystemPrompt(language: "zh" | "en" = "zh"): string {
  return language === "en" ? PLANNER_MEMO_SYSTEM_PROMPT_EN : PLANNER_MEMO_SYSTEM_PROMPT;
}

export function getPlannerMemoUserTemplate(language: "zh" | "en" = "zh"): string {
  return language === "en" ? PLANNER_MEMO_USER_TEMPLATE_EN : PLANNER_MEMO_USER_TEMPLATE;
}

export const PLANNER_MEMO_USER_TEMPLATE = `# 第 {{chapterNumber}} 章 memo 请求

{{brief_block}}
{{chapter_context_block}}

## 上一章最后一屏（原文节选）
{{previous_chapter_ending_excerpt}}

## 最近 3 章摘要
{{recent_summaries}}

## 当前 arc 正在推进什么
{{current_arc_prose}}

## 主角当前状态
{{protagonist_matrix_row}}

## 本章主要对手/阻力方
{{opponent_rows}}

## 本章主要协作者
{{collaborator_rows}}

## 可能被牵动的 thread（伏笔 + 支线）
{{relevant_threads}}

## 必须回收的陈旧 hook（本章必须 advance / resolve / 显式 defer）
{{recyclable_hooks}}

## 本章卷外约束
- 是否黄金三章：{{isGoldenOpening}}
- 硬约束（摘取本章可能触碰的条目）：
{{book_rules_relevant}}

请为第 {{chapterNumber}} 章产生 memo。严格按 YAML frontmatter + markdown 格式输出。`;

export interface PlannerUserMessageInput {
  readonly chapterNumber: number;
  readonly previousChapterEndingExcerpt: string;
  readonly recentSummaries: string;
  readonly currentArcProse: string;
  readonly protagonistMatrixRow: string;
  readonly opponentRows: string;
  readonly collaboratorRows: string;
  readonly relevantThreads: string;
  readonly recyclableHooks: string;
  readonly isGoldenOpening: boolean;
  readonly bookRulesRelevant: string;
  readonly brief?: string;
  readonly chapterContext?: string;
  readonly language?: "zh" | "en";
  /** Atelier literary truth context (formatted markdown). Empty when no truth files exist. */
  readonly literaryTruthContext?: string;
}

export function buildPlannerUserMessage(input: PlannerUserMessageInput): string {
  const language = input.language ?? "zh";
  const template = getPlannerMemoUserTemplate(language);
  const yesText = language === "en" ? "yes" : "是";
  const noText = language === "en" ? "no" : "否";

  const briefBlock = buildBriefBlock(input.brief ?? "", language);
  const chapterContextBlock = buildChapterContextBlock(input.chapterContext ?? "", language);
  const truthBlock = buildLiteraryTruthBlock(input.literaryTruthContext ?? "", language);

  const filled = template
    .replaceAll("{{chapterNumber}}", String(input.chapterNumber))
    .replaceAll("{{brief_block}}", briefBlock)
    .replaceAll("{{chapter_context_block}}", chapterContextBlock)
    .replaceAll("{{previous_chapter_ending_excerpt}}", input.previousChapterEndingExcerpt)
    .replaceAll("{{recent_summaries}}", input.recentSummaries)
    .replaceAll("{{current_arc_prose}}", input.currentArcProse)
    .replaceAll("{{protagonist_matrix_row}}", input.protagonistMatrixRow)
    .replaceAll("{{opponent_rows}}", input.opponentRows)
    .replaceAll("{{collaborator_rows}}", input.collaboratorRows)
    .replaceAll("{{relevant_threads}}", input.relevantThreads)
    .replaceAll("{{recyclable_hooks}}", input.recyclableHooks)
    .replaceAll("{{isGoldenOpening}}", input.isGoldenOpening ? yesText : noText)
    .replaceAll("{{book_rules_relevant}}", input.bookRulesRelevant);

  const golden = buildGoldenOpeningGuidance(input.chapterNumber, language);
  const parts: string[] = [filled];
  if (truthBlock) parts.push(truthBlock);
  if (golden) parts.push(golden);
  return parts.join("\n\n");
}

function buildLiteraryTruthBlock(truthContext: string, language: "zh" | "en"): string {
  const trimmed = truthContext.trim();
  if (!trimmed) return "";
  if (language === "en") {
    return `## Story bible (Atelier truth files — authoritative for theme/character/image/social/era)

Planning this chapter, treat the story bible below as authoritative. The chapter goal must refract the core proposition. Character actions must trace to the psychology map. Images used this chapter should respect the state machine (do not over-render same image consecutively). The chapter's social/historical pressure must be readable through one concrete detail.

${trimmed}`;
  }
  return `## 创作圣经（Atelier 真相文件 — 主题/人物/意象/社会/年代的最高授权来源）

规划本章时，下面这份创作圣经是权威。本章的 chapter goal 必须折射核心命题；人物动作必须可追溯到心理地图；本章使用的意象必须尊重状态机（不要在前后两章连续渲染同一意象）；社会/历史压力必须通过本章某个具体细节让读者读到。

${trimmed}`;
}

/**
 * Brief is the user's original creative document. It's the highest authority
 * source for "what this book is". story_frame/volume_map are the architect's
 * abstraction of brief; chapter memos must honor brief first.
 *
 * Returns "" when no brief exists (legacy books without brief.md).
 */
function buildBriefBlock(brief: string, language: "zh" | "en"): string {
  const trimmed = brief.trim();
  if (!trimmed) return "";
  if (language === "en") {
    return `## Creative brief (user's original intent — authoritative)
${trimmed}

The brief is the user's direct instruction. When planning this chapter, honor the brief's core setup (protagonist concept, world premise, opening mechanics, sample chapter hooks if any) before anything else. Do NOT defer the brief's core setup to later chapters; land it early.`;
  }
  return `## 用户创作 brief（原始意图——最高优先级）
${trimmed}

brief 是用户的直接指令。本章规划时，必须优先兑现 brief 里写明的核心设定（主角设定、世界前提、开场机制、样本章回钩子等）。**不要把 brief 里的核心设定推迟到后面的章节**——该在前几章落地的必须落地。`;
}

function buildChapterContextBlock(chapterContext: string, language: "zh" | "en"): string {
  const trimmed = chapterContext.trim();
  if (!trimmed) return "";
  if (language === "en") {
    return `## Per-chapter user instruction (highest priority for this chapter)
${trimmed}

This is the user's direct instruction for the current chapter. The memo must obey it before the outline fallback. If the user specifies a chapter title, preserve that title exactly in the memo so the writer can use it as CHAPTER_TITLE. If it conflicts with the volume outline, reconcile by keeping continuity but following this chapter instruction.`;
  }
  return `## 本章用户指令（本章最高优先级）
${trimmed}

这是用户对当前章节的直接指令。memo 必须优先遵守它，再参考卷纲兜底。如果用户指定了章节标题，必须在 memo 中原样保留该标题，供写手作为 CHAPTER_TITLE 使用。若它与卷纲不完全一致，保持连续性，但以本章用户指令为准。`;
}

// ---------------------------------------------------------------------------
// 黄金三章 prose guidance — Phase 6.5
// Single conditional append (chapterNumber <= 3). No new schema, no new
// runtime branch. Cohesive paragraphs, NOT a numbered checklist.
// ---------------------------------------------------------------------------

export function buildGoldenOpeningGuidance(
  chapterNumber: number,
  language: "zh" | "en" = "zh",
): string {
  if (chapterNumber > 3) return "";

  if (language === "en") {
    return `## Literary Opening Guidance — Chapter ${chapterNumber}

This is chapter ${chapterNumber} of the opening three. Serious-literary openings establish a voice, a place, and a thematic field — they refuse the commercial hook. Chapter 1 installs atmosphere and the protagonist's psychological baseline (their habit of attention — what they notice, what they refuse to notice); the thematic field surfaces tacitly through one ordinary act, never declared. Chapter 2 deepens one relationship and lets the social topology widen — the reader should glimpse this is not one hero's story but a press of lives. Chapter 3 makes the larger force framing the personal story (history, institution, class, ecology, generation) palpable; the protagonist need not have a goal, only a posture toward a situation.

The memo's goal field for this chapter must reflect the establishing slot's verb — install, deepen, or surface. The chapter-end change should be emotional residue — a held posture, an unasked question, an image's echo — not a commercial cliffhanger. Information layering is mandatory: basic facts (appearance, status, situation) ride on the protagonist's actions; the wider world emerges through detail and texture, never as exposition. A core image may appear apparently-meaninglessly, planting a seed for later resonance.`;
  }

  return `## 严肃文学开篇规划指引 — 第 ${chapterNumber} 章

这是开篇三章中的第 ${chapterNumber} 章。严肃文学的开篇要建立的是声音、地点和主题场——它拒绝商业钩子。第 1 章植入氛围和主角的心理基线（他注意什么、拒绝注意什么），主题场通过一个普通的动作隐隐浮现，绝不宣告。第 2 章让一段关系加深，让社会拓扑展开——读者要瞥见这不是一个英雄的故事，而是一群人压在一起过日子。第 3 章让框定个人故事的更大力量（历史、制度、阶级、生态、代际）变得可触；主角不必有"目标"，他只需要有一种处境和对这种处境的姿态。

本章 memo 的 goal 字段要体现这一槽位的动词——植入、加深、或浮现。章尾要发生的改变是"情绪余量"——悬停的姿态、未问出的问题、一个意象的回声——不是商业悬念。信息分层强制要求：基础信息（外貌、身份、处境）通过主角行动带出；更大的世界通过细节和肌理浮现，禁止说明性段落。核心意象可以在本章以"看似无意义"的方式第一次出现，为后续回响埋下种子。`;
}
