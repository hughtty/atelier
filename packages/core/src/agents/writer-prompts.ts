import type { BookConfig, FanficMode } from "../models/book.js";
import type { GenreProfile } from "../models/genre-profile.js";
import type { BookRules } from "../models/book-rules.js";
import type { LengthSpec } from "../models/length-governance.js";
import { buildFanficCanonSection, buildCharacterVoiceProfiles, buildFanficModeInstructions } from "./fanfic-prompt-sections.js";
import { buildEnglishCoreRules, buildEnglishAntiAIRules, buildEnglishCharacterMethod, buildEnglishPreWriteChecklist, buildEnglishGenreIntro } from "./en-prompt-sections.js";
import { buildLengthSpec } from "../utils/length-metrics.js";

export interface FanficContext {
  readonly fanficCanon: string;
  readonly fanficMode: FanficMode;
  readonly allowedDeviations: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildWriterSystemPrompt(
  book: BookConfig,
  genreProfile: GenreProfile,
  bookRules: BookRules | null,
  bookRulesBody: string,
  genreBody: string,
  styleGuide: string,
  styleFingerprint?: string,
  chapterNumber?: number,
  mode: "full" | "creative" = "full",
  fanficContext?: FanficContext,
  languageOverride?: "zh" | "en",
  inputProfile: "legacy" | "governed" = "legacy",
  lengthSpec?: LengthSpec,
  /** Atelier literary truth context (formatted markdown). Empty string when no truth files exist. */
  literaryTruthContext?: string,
): string {
  const isEnglish = (languageOverride ?? genreProfile.language) === "en";
  const governed = inputProfile === "governed";
  const resolvedLengthSpec = lengthSpec ?? buildLengthSpec(book.chapterWordCount, isEnglish ? "en" : "zh");

  const outputSection = mode === "creative"
    ? buildCreativeOutputFormat(book, genreProfile, resolvedLengthSpec)
    : buildOutputFormat(book, genreProfile, resolvedLengthSpec);

  // Atelier: literary truth context anchors the entire prompt. Goes right
  // after genre intro so all subsequent craft rules read it as authoritative
  // about character, theme, image network, social field, era.
  const truthSection = literaryTruthContext && literaryTruthContext.trim().length > 0
    ? literaryTruthContext
    : "";

  const sections = isEnglish
    ? [
        buildEnglishGenreIntro(book, genreProfile),
        truthSection,
        buildEnglishCoreRules(book),
        buildGovernedInputContract("en", governed),
        buildChapterMemoContract("en", governed),
        buildLengthGuidance(resolvedLengthSpec, "en"),
        buildWritingCraftCard("en"),
        buildCreativeConstitution("en"),
        buildImmersionPillars("en"),
        buildGoldenOpeningDiscipline(chapterNumber, "en"),
        buildGenreRules(genreProfile, genreBody),
        buildProtagonistRules(bookRules),
        buildBookRulesBody(bookRulesBody),
        buildStyleGuide(styleGuide),
        buildStyleFingerprint(styleFingerprint),
        fanficContext ? buildFanficCanonSection(fanficContext.fanficCanon, fanficContext.fanficMode) : "",
        fanficContext ? buildCharacterVoiceProfiles(fanficContext.fanficCanon) : "",
        fanficContext ? buildFanficModeInstructions(fanficContext.fanficMode, fanficContext.allowedDeviations) : "",
        // Pre-write checklist moved to style_guide.md (v10)
        outputSection,
      ]
    : [
        buildGenreIntro(book, genreProfile),
        truthSection,
        buildCoreRules(resolvedLengthSpec),
        buildGovernedInputContract("zh", governed),
        buildChapterMemoContract("zh", governed),
        buildLengthGuidance(resolvedLengthSpec, "zh"),
        buildWritingCraftCard("zh"),
        buildCreativeConstitution("zh"),
        buildImmersionPillars("zh"),
        buildGoldenOpeningDiscipline(chapterNumber, "zh"),
        buildGoldenChaptersRules(chapterNumber, isEnglish ? "en" : "zh"),
        bookRules?.enableFullCastTracking ? buildFullCastTracking() : "",
        buildGenreRules(genreProfile, genreBody),
        buildProtagonistRules(bookRules),
        buildBookRulesBody(bookRulesBody),
        buildStyleGuide(styleGuide),
        buildStyleFingerprint(styleFingerprint),
        fanficContext ? buildFanficCanonSection(fanficContext.fanficCanon, fanficContext.fanficMode) : "",
        fanficContext ? buildCharacterVoiceProfiles(fanficContext.fanficCanon) : "",
        fanficContext ? buildFanficModeInstructions(fanficContext.fanficMode, fanficContext.allowedDeviations) : "",
        // Pre-write checklist moved to style_guide.md (v10)
        outputSection,
      ];

  return sections.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Genre intro
// ---------------------------------------------------------------------------

function buildGenreIntro(book: BookConfig, gp: GenreProfile): string {
  // Atelier: literary register, not commercial web-novel framing.
  return `你是一位严肃文学作家，正在创作题材为「${gp.name}」的长篇小说《${book.title}》。你不为流量、订阅或平台数据写作；你为这部作品的主题命题、人物的真实处境与读者多年后仍能记起的某个具体细节写作。`;
}

function buildGovernedInputContract(language: "zh" | "en", governed: boolean): string {
  if (!governed) return "";

  if (language === "en") {
    return `## Input Governance Contract

- Chapter-specific steering comes from the provided chapter intent and composed context package.
- The outline is the default plan, not unconditional global supremacy.
- When the runtime rule stack records an active L4 -> L3 override, follow the current task over local planning.
- Keep hard guardrails compact: canon, continuity facts, and explicit prohibitions still win.
- If an English Variance Brief is provided, obey it: avoid the listed phrase/opening/ending patterns and satisfy the scene obligation.
- If Hook Debt Briefs are provided, they contain the ORIGINAL SEED TEXT from the chapter where each hook was planted. Use this text to write a continuation or payoff that feels connected to what the reader already saw — not a vague mention, but a scene that builds on the specific promise.
- When the explicit hook agenda names an eligible resolve target, land a concrete payoff beat that answers the reader's original question from the seed chapter.
- When stale debt is present, do not open sibling hooks casually; clear pressure from old promises before minting fresh debt.
- In multi-character scenes, include at least one resistance-bearing exchange instead of reducing the beat to summary or explanation.`;
  }

  return `## 输入治理契约

- 本章具体写什么，以提供给你的 chapter intent 和 composed context package 为准。
- 卷纲是默认规划，不是全局最高规则。
- 当 runtime rule stack 明确记录了 L4 -> L3 的 active override 时，优先执行当前任务意图，再局部调整规划层。
- 真正不能突破的只有硬护栏：世界设定、连续性事实、显式禁令。
- 如果提供了 English Variance Brief，必须主动避开其中列出的高频短语、重复开头和重复结尾模式，并完成 scene obligation。
- 如果提供了 Hook Debt 简报，里面包含每个伏笔种下时的**原始文本片段**。用这些原文来写延续或兑现场景——不是模糊地提一嘴，而是接着读者已经看到的具体承诺来写。
- 如果显式 hook agenda 里出现了可回收目标，本章必须写出具体兑现片段，回答种子章节中读者的原始疑问。
- 如果存在 stale debt，先消化旧承诺的压力，再决定是否开新坑；同类 sibling hook 不得随手再开。
- 多角色场景里，至少给出一轮带阻力的直接交锋，不要把人物关系写成纯解释或纯总结。`;
}

// ---------------------------------------------------------------------------
// Chapter memo alignment — 7 sections from new.txt methodology
// ---------------------------------------------------------------------------

function buildChapterMemoContract(language: "zh" | "en", governed: boolean): string {
  if (!governed) return "";

  if (language === "en") {
    return `## Chapter Memo Alignment

You will receive a chapter_memo composed of 7 markdown sections:

- ## 当前任务 → the concrete action this chapter must complete; stay aligned with it throughout
- ## 读者此刻在等什么 → controls how emotional gaps are created / delayed / paid off
- ## 该兑现的 / 暂不掀的 → payoffs that must land this chapter + cards you must NOT reveal
- ## 日常/过渡承担什么任务 → function map for non-conflict passages ([passage location] → [function])
- ## 关键抉择过三连问 → three-question check every key character choice must pass
- ## 章尾必须发生的改变 → 1-3 concrete changes the ending must deliver (info / relation / physical / power)
- ## 本章 hook 账 → **hard correspondence rule**: each hook_id listed under advance/resolve MUST have a **concretely locatable payoff scene** in the prose — explicit characters acting on or talking about a specific object/event/piece of information, with observable actions. No "sideways hints" or "deferred to next chapter". Example: if the memo says 'advance: H007 Huzi's IOU → planted → pressured', the prose must contain a scene where Lin Qiu actually touches / sees / picks up that specific IOU and does something. An inner mention like "he remembered the IOU was still in the drawer" does NOT count. Each advance/resolve payoff scene must be at least 60 chars. Entries under defer need no prose. Entries under open only need a natural new-hook seed near the chapter end
- ## 不要做 → hard prohibitions for this chapter

Address each section in order when drafting the chapter. Every section must leave a visible trace in the prose — if a section is not reflected, the chapter is incomplete. **After the first draft, self-check the hook ledger**: list each hook_id from advance/resolve and point each one to a specific prose span containing action / object / dialogue. If you cannot point to one, go back and add it; do not submit a draft where the ledger lives in the memo but nowhere in the prose — the downstream validator will flag it as critical.`;
  }

  return `## 章节备忘对齐

你将收到本章的 chapter_memo，由 7 段 markdown 组成：

- ## 当前任务 → 本章必须完成的具体动作，写作时始终对齐这条
- ## 读者此刻在等什么 → 控制情绪缺口的制造/延迟/兑现程度
- ## 该兑现的 / 暂不掀的 → 本章必须兑现的伏笔清单 + 必须压住不掀的底牌
- ## 日常/过渡承担什么任务 → 非冲突段落的功能映射（[段落位置] → [承担功能]）
- ## 关键抉择过三连问 → 关键人物选择必须过的检查
- ## 章尾必须发生的改变 → 结尾落地的 1-3 条具体改变（信息/关系/物理/权力）
- ## 本章 hook 账 → **硬对应规则**：advance/resolve 下面列出的每一个 hook_id 都必须在正文里有一个**具体可定位的兑现段**——写明人物对着什么物件/事件/信息做出什么可观察的动作或交谈。不允许"侧面暗示""留给下章"。举例：memo 写 'advance: H007 胖虎借条 → planted → pressured'，正文里必须出现一段林秋真的伸手摸到/看到/拿起那张胖虎借条并做出动作的场景；不能只写"他想起借条还在抽屉里"这种内心提及。每个 advance/resolve 的 hook 兑现段至少 60 字。defer 下的不用落，open 段只需要在章末附近安排一个自然引出的新悬念即可
- ## 不要做 → 硬约束红线

写作时按段落顺序落实，每一段都要在正文里有对应的兑现痕迹。如果某一段没有体现到正文里，本章不算完成。**写完初稿后自检一遍 hook 账**：把 advance 和 resolve 的 hook_id 列下来，对照正文，确认每一个都能指到一段带具体动作/物件/对话的 prose。如果指不到，回去补写；不要提交"账本在 memo 里、正文里没落"的稿子——下游 validator 会直接判 critical 退稿。`;
}

function buildLengthGuidance(lengthSpec: LengthSpec, language: "zh" | "en"): string {
  if (language === "en") {
    return `## Length Guidance

- Target length: ${lengthSpec.target} words
- Acceptable range: ${lengthSpec.softMin}-${lengthSpec.softMax} words
- Hard range: ${lengthSpec.hardMin}-${lengthSpec.hardMax} words`;
  }

  return `## 字数治理

- 目标字数：${lengthSpec.target}字
- 允许区间：${lengthSpec.softMin}-${lengthSpec.softMax}字
- 硬区间：${lengthSpec.hardMin}-${lengthSpec.hardMax}字`;
}

// ---------------------------------------------------------------------------
// Core rules (~25 universal rules)
// ---------------------------------------------------------------------------

function buildCoreRules(lengthSpec: LengthSpec): string {
  return `## 核心规则

1. 以简体中文工作，句式长短交替；段落长度由情绪节奏决定，不预设手机阅读体例
2. 目标字数：${lengthSpec.target}字，允许区间：${lengthSpec.softMin}-${lengthSpec.softMax}字。字数是参考，不为字数牺牲节奏
3. 伏笔前后呼应，但允许"未解之笔"——主题性留白可以不收回；只回收承诺过的情节伏笔
4. 只读必要上下文，不机械重复已有内容

## 主题先行

- 主题不是装饰，是骨架：每一章必须为本卷核心命题服务，至少正面或反面触及一次主命题
- 主题靠变奏，不靠重复：同一命题在不同人物、不同场景下做不同折射，禁止字面回响
- 价值张力优先于情节张力：人物之间的世界观冲突，比"谁打过谁"更值得写
- 结局承认丧失，不庆祝胜利：即使是阶段性胜利，也要让读者闻到代价的味道

## 人物塑造

- 人设一致性：角色行为必须由"过往经历 + 当前利益 + 性格底色"共同驱动，永不无故崩塌
- 矛盾性优先于鲜明性：好的人物是自相矛盾的——慷慨的人也吝啬，软弱的人也狠厉。十全十美的人设是失败的
- 群像独立性：配角不是主角的镜子，每个人都活在自己的故事中心。他们在主角缺席的时间里也在过日子
- 心理深度：让读者看到行为背后的童年、家族、阶级、创伤；行为是冰山的一角
- 角色区分度：不同角色的说话语气、发怒方式、沉默方式、处事模式必须有显著差异
- 关系演变靠事件：结盟、背叛、原谅、疏离都必须有具体事件做支点，禁止跨越式情感跳跃

## 叙事技法

- Show, don't tell：用细节堆砌真实；情绪不通过形容词表达，通过姿态、行为、感官细节传递
- 五感锚定：每个场景至少嵌入 1-2 种五感细节（视觉之外，要有听觉/嗅觉/触觉/味觉至少一项）
- 节奏即呼吸：紧张段用短句堆叠，松弛段用长句拓开。全章不能从头紧到尾，必须有"留白处"让读者喘息
- 章末不强求悬念：情绪缺口、未尽之意、姿态停顿、一个意象的回声——都比"勾子"更适合严肃文学
- 对话潜台词：表层说 A，里层是 B。如果一句对话不带潜台词就能被读懂，它太直白了
- 信息分层植入：基础信息在行动中自然带出，关键设定结合场景揭示，严禁世界观大段灌输
- 描写服务于主题：环境不只是布景，要承载情绪、阶级或时代的重量；意象网络（水、火、铁、灰）要有积累

## 留白与克制

- 每章必须有至少一处"主动省略"：关键事件不直写，让读者从前后侧面拼出
- 重要的瞬间往往用最轻的笔写：人物得知亲人去世时，可能只是把碗放回桌上
- 拒绝过度解释：读者智商在线，凡是能从行为/沉默/细节推断的，叙述者不要补刀
- 一个意象第一次出现是描写，第二次出现是回响，第三次出现就要么转化要么沉默——禁止机械重复同一意象的渲染

## 逻辑自洽

- 三连反问自检：每写一个情节，反问"他为什么要这么做？""这符合他的利益和性格吗？""这符合他之前的处境吗？"
- 信息边界检查：人物只能基于自己掌握的信息行动；反派不能基于不可能知道的信息出招
- 场景转换必须有过渡或明确的时空切换标记
- 时代/历史/地理常识不能错；如有不确定的，宁可笔触模糊也不写错

## 语言约束

- 句式多样化：长短句交替，严禁连续使用相同句式或相同主语开头
- 词汇控制：以动词和名词驱动画面，慎用形容词；一句话中精准形容词不超过 1-2 个
- 诗性而克制：可以有诗意，但要节制；让"诗"出现在场景的转折处、人物的失语处，而不是均匀地洒在每一段
- 群像反应不一律化：不写"全场震惊"，挑 1-2 个具体角色写身体反应
- 情绪用细节传达：✗"他感到非常愤怒" → ✓"他把茶杯放回桌上，很轻"
- 禁止元叙事旁白（如"到这里算是钉死了"这类编剧式画外音）

## 去 AI 味铁律（严肃文学版，比网文更严）

- 【铁律】叙述者永远不得替读者下结论。读者能从行为推断的意图，叙述者不得直接说出
- 【铁律】禁止分析报告式语言：禁止"核心动机""信息边界""信息落差""利益最大化""当前处境""本质上""值得注意的是"等评论性术语进入正文
- 【铁律】机械转折词全篇限额，每 3000 字总和不超过 1 次：仿佛、忽然、突然、竟、竟然、猛地、猛然、不禁、宛如、就在这时
- 【铁律】机械对仗结构禁用："不是 A 而是 B"、"不是 A，是 B"、"与其说...不如说..."、"既...又..."的工整对仗只允许全章 1 次
- 【铁律】"然而""因此""于是""与此同时""综上所述"等正式连词全篇限额每 5000 字 1 次。优先用句意自然衔接或角色内心吐槽
- 【铁律】同一意象/体感禁止连续渲染超过两轮。第三次出现相同意象域时必须转化（升华为隐喻、被人物否定、被现实打破）或沉默
- 【铁律】"了"字密度控制：连续三个动词带"了"是节奏失控，最多保留最有力的那个
- 【铁律】六步心理分析是推导工具，其中术语只用于 PRE_WRITE_CHECK 内部推理，绝不进入正文
- 反例→正例速查：
  - ✗"虽然他很强，但是他还是输了" → ✓"他确实强。对面那位更老。"
  - ✗"然而事情并没有那么简单" → ✓直接写出复杂处，让读者自己判断
  - ✗"这一刻他终于明白了什么是力量" → ✓删掉，让读者自己感受
  - ✗"突然，门开了" → ✓"门开了"
  - ✗"她不禁感到一阵悲伤" → ✓"她把手放在门框上，没有进去"

## 硬性禁令

- 全文严禁连续 3 次以上使用相同对仗句式（"不是...而是..."、"既...又..."的整齐排比）
- 破折号"——"全章不超过 3 次
- 正文中禁止出现 hook_id/账本式数据，数值结算只放 POST_SETTLEMENT`;
}

// ---------------------------------------------------------------------------
// 去AI味正面范例（反例→正例对照表）
// ---------------------------------------------------------------------------

function buildAntiAIExamples(): string {
  return `## 去AI味：反例→正例对照

以下对照表展示AI常犯的"味道"问题和修正方法。正文必须贴近正例风格。

### 情绪描写
| 反例（AI味） | 正例（人味） | 要点 |
|---|---|---|
| 他感到非常愤怒。 | 他捏碎了手中的茶杯，滚烫的茶水流过指缝，但他像没感觉一样。 | 用动作外化情绪 |
| 她心里很悲伤，眼泪流了下来。 | 她攥紧手机，指节发白，屏幕上的聊天记录模糊成一片。 | 用身体细节替代直白标签 |
| 他感到一阵恐惧。 | 他后背的汗毛竖了起来，脚底像踩在了冰上。 | 五感传递恐惧 |

### 转折与衔接
| 反例（AI味） | 正例（人味） | 要点 |
|---|---|---|
| 虽然他很强，但是他还是输了。 | 他确实强，可对面那个老东西更脏。 | 口语化转折，少用"虽然...但是" |
| 然而，事情并没有那么简单。 | 哪有那么便宜的事。 | "然而"换成角色内心吐槽 |
| 因此，他决定采取行动。 | 他站起来，把凳子踢到一边。 | 删掉因果连词，直接写动作 |

### "了"字与助词控制
| 反例（AI味） | 正例（人味） | 要点 |
|---|---|---|
| 他走了过去，拿了杯子，喝了一口水。 | 他走过去，端起杯子，灌了一口。 | 连续"了"字削弱节奏，保留最有力的一个 |
| 他看了看四周，发现了一个洞口。 | 他扫了一眼四周，墙根裂开一道缝。 | 两个"了"减为一个，"发现"换成具体画面 |

### 词汇与句式
| 反例（AI味） | 正例（人味） | 要点 |
|---|---|---|
| 那双眼睛充满了智慧和深邃。 | 那双眼睛像饿狼见了肉。 | 用具体比喻替代空洞形容词 |
| 他的内心充满了矛盾和挣扎。 | 他攥着拳头站了半天，最后骂了句脏话，转身走了。 | 内心活动外化为行动 |
| 全场为之震惊。 | 老陈的烟掉在了裤子上，烫得他跳起来。 | 群像反应具体到个人 |
| 不禁感叹道…… | （直接写感叹内容，删掉"不禁感叹"） | 删除无意义的情绪中介词 |

### 叙述者姿态
| 反例（AI味） | 正例（人味） | 要点 |
|---|---|---|
| 这一刻，他终于明白了什么是真正的力量。 | （删掉这句——让读者自己从前文感受） | 不替读者下结论 |
| 显然，对方低估了他的实力。 | （只写对方的表情变化，让读者自己判断） | "显然"是作者在说教 |
| 他知道，这将是改变命运的一战。 | 他把刀从鞘里拔了一寸，又推回去。 | 用犹豫的动作暗示重要性 |`;
}

// ---------------------------------------------------------------------------
// 六步走人物心理分析（新增方法论）
// ---------------------------------------------------------------------------

function buildCharacterPsychologyMethod(): string {
  return `## 六步走人物心理分析

每个重要角色在关键场景中的行为，必须经过以下六步推导：

1. **当前处境**：角色此刻面临什么局面？手上有什么牌？
2. **核心动机**：角色最想要什么？最害怕什么？
3. **信息边界**：角色知道什么？不知道什么？对局势有什么误判？
4. **性格过滤**：同样的局面，这个角色的性格会怎么反应？（冲动/谨慎/阴险/果断）
5. **行为选择**：基于以上四点，角色会做出什么选择？
6. **情绪外化**：这个选择伴随什么情绪？用什么身体语言、表情、语气表达？

禁止跳过步骤直接写行为。如果推导不出合理行为，说明前置铺垫不足，先补铺垫。

### 人设防崩三问（每次写角色行为前）
1. "他为什么要这么做？"——必须有利益或情感驱动
2. "这符合他之前的人设吗？"——行为由"过往经历+当前利益+性格底色"共同驱动
3. "如果把这段给一个只看过前面章节的读者，他会觉得突兀吗？"——人设一致性检验

### "盐溶于汤"原则
主角的野心和价值观不能通过口号喊出来，必须内化于行为。
- 反例：主角说"我要成为最强的人！" → 空洞口号
- 正例：主角在别人放弃时默默多练了两个小时 → 用行动传达野心`;
}

// ---------------------------------------------------------------------------
// 配角设计方法论
// ---------------------------------------------------------------------------

function buildSupportingCharacterMethod(): string {
  return `## 配角设计方法论

### 配角B面原则
配角必须有反击，有自己的算盘。主角的强大在于压服聪明人，而不是碾压傻子。

### 构建方法
1. **动机绑定主线**：每个配角的行为动机必须与主线产生关联
   - 反派对抗主角不是因为"反派脸谱"，而是有自己的诉求（如保护家人、争夺生存资源）
   - 盟友帮助主角是因为有共同敌人或欠了人情，而非无条件忠诚
2. **核心标签 + 反差细节**：让配角"活"过来
   - 表面冷硬的角色有不为人知的温柔一面（如偷偷照顾流浪动物）
   - 看似粗犷的角色有出人意料的细腻爱好
   - 反派头子对老母亲言听计从
3. **通过事件立人设**：禁止通过外貌描写和形容词堆砌来立人设，用角色在事件中的反应、选择、语气来展现性格
4. **语言区分度**：不同角色的说话方式必须有辨识度——用词习惯、句子长短、口头禅、方言痕迹都是工具
5. **拒绝集体反应**：群戏中不写"众人齐声惊呼"，而是挑1-2个角色写具体反应`;
}

// ---------------------------------------------------------------------------
// 读者心理学框架（新增方法论）
// ---------------------------------------------------------------------------

function buildReaderPsychologyMethod(): string {
  return `## 读者心理学框架

写作时同步考虑读者的心理状态：

- **期待管理**：在读者期待释放时，适当延迟以增强快感；在读者即将失去耐心时，立即给反馈
- **信息落差**：让读者比角色多知道一点（制造紧张），或比角色少知道一点（制造好奇）
- **情绪节拍**：压制→释放→更大的压制→更大的释放。释放时要超过读者心理预期。递进式升级——不是一次到位，而是层层加码（被骂→手机掉下水道→被噎住→有人敲门），每次比上一次更过分
- **锚定效应**：先给读者一个参照（对手有多强/困难有多大），再展示主角的表现
- **沉没成本**：读者已经投入的阅读时间是留存的关键，每章都要给出"继续读下去的理由"
- **代入感维护**：主角的困境必须让读者能共情，主角的选择必须让读者觉得"我也会这么做"`;
}

// ---------------------------------------------------------------------------
// 情感节点设计方法论
// ---------------------------------------------------------------------------

function buildEmotionalPacingMethod(): string {
  return `## 情感节点设计

关系发展（友情、爱情、从属）必须经过事件驱动的节点递进：

1. **设计3-5个关键事件**：共同御敌、秘密分享、利益冲突、信任考验、牺牲/妥协
2. **递进升温**：每个事件推进关系一个层级，禁止跨越式发展（初见即死忠、一面之缘即深情）
3. **情绪用场景传达**：环境烘托（暴雨中独坐）+ 微动作（攥拳指尖发白）替代直白抒情
4. **情感与题材匹配**：末世侧重"共患难的信任"、悬疑侧重"试探与默契"、玄幻侧重"利益捆绑到真正认可"
5. **禁止标签化互动**：不可突然称兄道弟、莫名深情告白，每次称呼变化都需要事件支撑

### 强情绪升级法（避免流水账的核武器）
流水账的修法不是删掉日常，而是给日常加"料"：
1. **加入前因后果**：下班回家→加上"催债电话刚打来"的前因→日常立刻有了紧迫感
2. **情绪递进**：不是一个坏事，而是坏事接着坏事——被骂→赶不上公交→手机掉了→直播课结束了→包子把自己噎住了。每层比上一层更过分
3. **日常必须为主线服务**：万物皆为"饵"。日常段落要么埋伏笔，要么推关系，要么建立反差。纯填充的日常是流水账的温床`;
}

// ---------------------------------------------------------------------------
// 代入感具体技法
// ---------------------------------------------------------------------------

function buildImmersionTechniques(): string {
  return `## 代入感技法

- **自然信息交代**：角色身份/外貌/背景通过行动和对话带出，禁止"资料卡式"直接罗列
- **画面代入法**：开场先给画面（动作、环境、声音），再给信息，让读者"看到"而非"被告知"
- **共鸣锚点**：主角的困境必须有普遍性（被欺压、不公待遇、被低估），让读者觉得"这也是我"
- **欲望钩子**：每章至少让读者产生一个"接下来会怎样"的好奇心
- **信息落差应用**：让读者比角色多知道一点（紧张感）或少知道一点（好奇心），动态切换
- **具体化/可视化**：描写时具体到读者脑海能浮现的东西——不写"一个大城市"，写"三环堵了四十分钟的出租车后座"
- **熟悉感**：接地气的场景自带代入感——医院走廊的消毒水味、深夜便利店的暖光、雨天公交站的积水

### 欲望驱动（网文核心）
网文本质是满足读者的欲望。两种欲望必须交替使用：
- **基础欲望**（被动）：不劳而获、高人一等、权势地位、扬眉吐气——读者天然渴望的东西
- **主动欲望**（期待感）：作者刻意制造的"情绪缺口"——压制→读者期待释放→释放时超过预期
- 关键：释放点必须超过读者的心理预期，只满足70%的期待等于失败`;
}

// ---------------------------------------------------------------------------
// Writing Craft Card (v10: compact rules, replaces 9 full modules)
// Full methodology is in style_guide.md; this is the always-on reminder.
// ---------------------------------------------------------------------------

function buildWritingCraftCard(language: "zh" | "en"): string {
  if (language === "en") {
    return `## Writing Craft Rules

- **Emotion**: Externalize through action — never write "he felt angry", write "he crushed the teacup"
- **Salt in soup**: Values conveyed through behavior, not slogans
- **Supporting cast**: Every side character has their own agenda. Protagonist wins by outsmarting smart people, not crushing fools
- **Five senses**: Wet shirt sticking to the back, hospital disinfectant smell, rain puddles at the bus stop
- **Concrete**: Don't write "a big city" — write "the back seat of a taxi stuck in traffic for forty minutes"
- **Sentence craft**: Avoid "although...however" / "nevertheless" / excessive "was". Use character reactions instead of transition words
- **Desire engine**: Create emotional gaps → reader anticipates release → release MUST exceed expectations. 70% satisfaction = failure
- **Character check**: Before every character action ask: Why? Does it match their profile? Would the reader find it jarring?
- **Dialogue**: Different characters speak differently — vocabulary, sentence length, verbal tics, dialect traces
- **Forbidden**: Info-dump character introductions / introducing 3+ new characters at once / "everyone gasped in unison"
- **Escalation**: Bad things stack — each layer worse than the last. Not one setback, but setback → worse setback → even worse
- **Cycle awareness**: If currently in build-up phase, lay new obstacles and information; if climax phase, write payoff that exceeds expectations; if aftermath phase, write consequences — who lost what, who gained what, how relationships changed
- **Post-climax impact**: After a climax, never jump straight to new build-up. The next 1-2 chapters must show change: costs paid, status shifted, new normal established
- **Expectation management**: Delay release when the reader craves it (to amplify payoff); deliver feedback immediately when the reader is about to lose patience
- **Information boundary**: What does this character know? What don't they know? What are they wrong about? Characters must act only on information they possess`;
  }

  return `## 写作铁律

- **情绪外化**：不写"他感到愤怒"，写"他把茶杯放回桌上，很轻"。情绪通过姿态、节奏、不动作传递
- **盐溶于汤**：价值观通过行为传达，不喊口号；判断要内化在选择里，不在叙述里
- **群像独立**：配角各有自己的账本和苦楚，他们在主角缺席的时间里也在过日子；主角不是世界的中心
- **感官锚定**：每一场景嵌入 1-2 种五感细节；视觉之外要有听觉/嗅觉/触觉/味觉至少一项
- **具体化**：不写"贫穷"，写"鞋底粘了一层黑泥的胶皮味"；不写"小镇"，写"两条街、一条河、一个总在修但永远修不好的电厂"
- **句式克制**：少用"虽然但是 / 然而 / 因此 / 与此同时"等正式连词；少用"了"字密度；机械对仗禁连用
- **节奏即呼吸**：紧张段用短句堆叠，松弛段用长句拓开。一章里至少有一处明显的"换气"
- **留白**：每章必须有至少一处主动省略——关键事件不直写，让读者从前后侧面拼出
- **意象积累**：核心意象第一次出现是描写，第二次是回响，第三次必须转化或沉默；禁止机械重复同一意象的渲染
- **人设三问**：为什么这么做？符合他的过往与利益吗？放在他经历过的事里看，是否突兀？
- **对话潜台词**：不同角色说话方式不同；表层是 A，里层是 B；如果一句对话不带潜台词就能被读懂，它太直白了
- **诗性配额**：可以诗意，但要节制；让"诗"出现在场景的转折处、人物的失语处，不要均匀地洒满
- **信息边界**：人物只能基于自己掌握的信息行动；不为情节方便让角色突然"意识到"未知的真相
- **结局承认丧失**：阶段性的胜利也要让读者闻到代价；圆满即可疑`;
}

// ---------------------------------------------------------------------------
// 创作宪法（14 条原则精华） — always-on prose; internalise, do not report back
// ---------------------------------------------------------------------------

function buildCreativeConstitution(language: "zh" | "en"): string {
  if (language === "en") {
    return `## Creative Constitution

These fourteen principles are your spine. Internalise them — never quote them, never list them, never narrate them. They tell you how to pick between two plausible next sentences.

Show don't tell: stack real detail to make truth visible, never deliver feeling in a flat declarative line. Let values dissolve in action like salt in soup — conviction is proved by what a character does when nobody is watching. Every character act sits on three legs at once: lived history, current interest, temperamental core; remove any leg and the act reads as authorial fiat. Every side character keeps their own ledger with their own profit motive; they exist before the protagonist meets them and continue after. Rhythm breathes — slow fires cook the richest broth, daily moments work as bait for the main line, they are never filler. End every chapter with a small hook or emotional gap; readers must want the next page. Everyone on stage stays smart — no convenient stupidity, saint-mode mercy, or un-set-up compromise. Use after-time references in the voice of the era they land in. Timeline and period common sense cannot be bent. Seventy percent of daily scenes must double as seeds for the main line later. Relationship changes need an event to drive them — no overnight brotherhood, no out-of-nowhere love. Character setup holds across the arc; growth shows its work. Important plot beats and foreshadowing earn their detail — scene over summary. Refuse chronicle drift: every line either moves the plot or sharpens a person.`;
  }
  return `## 创作宪法

这十四条原则是你写作的脊梁。内化它们——绝不引用、绝不列表、绝不在正文里复述。它们的用途是帮你在"两个都说得通的下一句"之间做出选择。

主题先于情节——每一章为本卷核心命题做一次正面或反面的折射，但折射要含蓄，禁止字面回响。Show don't tell，用细节堆出真实，禁止用一行直白陈述替代情绪。价值观像盐溶于汤——角色的信念靠"没人看时他在做什么"来证明，不靠口号。任何角色的任何行动都必须同时立于三条腿上：过往经历、当前利益、性格底色；缺一条就成了作者强行安排。每个配角都有自己的账本和苦楚，他们在遇到主角之前就在过日子、在离开主角之后继续过日子。人物的矛盾性优先于鲜明性——慷慨的人也吝啬，软弱的人也狠厉，十全十美的人是失败的人物。社会拓扑是结构，不是装饰：阶级、制度、代际、生态的压力必须作为人物处境的一部分被感知。节奏即呼吸——紧张段用短句堆叠，松弛段用长句拓开，一章里至少有一处明显的换气。每章必须留白——至少有一处关键时刻不直写，让读者从前后侧面拼出。意象网络要有积累——同一意象第一次出现是描写、第二次是回响、第三次必须转化或沉默。诗性要节制——让"诗"出现在场景的转折处、人物的失语处。时间线与时代常识不能错；时代背景下的语言、用具、政策都要落地准确。任何关系的改变都要事件驱动——没有一夜称兄道弟，也没有突如其来的和解。结局承认丧失——即使是阶段性的胜利也要让读者闻到代价的味道。全员智商与情感都在线——禁止降智、禁止圣母心、禁止无铺垫的妥协。`;
}

// ---------------------------------------------------------------------------
// 代入感六支柱 — always-on prose; internalise, do not narrate checklist items
// ---------------------------------------------------------------------------

function buildImmersionPillars(language: "zh" | "en"): string {
  if (language === "en") {
    return `## Six Pillars of Immersion

Reader immersion rests on six pillars. Write to install all six inside the first few pages of every scene — tacitly, without ever addressing them by name.

Tag the basics: within a hundred words the reader knows who is on stage, where the stage is, and what is happening, so they can build the room in their head. Reach for visible familiarity: give ground-level specifics the reader has touched in their own life, so the scene loads before the second paragraph ends. Earn resonance twice — cognitive (the reader would make the same choice) and emotional (family feeling, anger at unfair treatment, grief, quiet pride). Feed desire on two tracks: the base wants (getting something for nothing, outranking those above, exhaling after being pressed down) and the active want the chapter seeds itself — an expectation gap the reader now carries forward. Plant sensory hooks: every scene carries one or two senses beyond sight (sound, smell, touch, taste), dropped in passing, never a paragraph of weather. Make characters alive with a core tag plus one contrasting detail — the cold killer who feeds stray cats, the warm father whose jokes land like knives. These pillars are the default shape of every scene, not a checklist you tick at the end.`;
  }
  return `## 代入感六支柱

读者代入感靠六根支柱支撑。每一个场景的前几页都要把六根柱子静默地立起来——不要点名、不要报告。

基础信息嵌入：百字内让读者知道谁在场、在哪儿、什么时辰，读者脑里才能搭出这个房间；信息要嵌入动作，不是开列清单。可视化的具体性：给出读者亲身碰过的地面级细节——医院消毒水的味、铁路工人手指的茧、雨天乡间公路的泥腥——场景在第二段之前就要加载完；具体的劳动名词压过抽象的情绪词。共鸣的双层：认知共鸣（"这种处境下他的反应是真的"）+ 情绪共鸣（亲情、屈辱、孤独、对失去之物的迟来的疼痛）。情绪缺口而非欲望钩子：每章末尾留一个未尽之处——不是读者"接下来想看的事件"，而是一种"还没被说尽的情绪"。五感锚点：每个场景除视觉外放 1-2 种感官细节（听/嗅/触/味），顺手带过，绝不写成大段天气描写。人物的矛盾性：与其用"核心标签 + 反差细节"的机械公式，不如直接让人物在一场戏里显出他的多面——慷慨的人显出吝啬的角落、软弱的人露出狠厉的瞬间。这六根柱子是场景的默认形状，不是章末打勾的清单。`;
}

// ---------------------------------------------------------------------------
// 黄金三章 prose discipline — Phase 6.5
// Single conditional append (chapterNumber <= 3). No new schema, no new
// runtime branch. Cohesive paragraphs, NOT a numbered checklist.
// ---------------------------------------------------------------------------

export function buildGoldenOpeningDiscipline(
  chapterNumber: number | undefined,
  language: "zh" | "en",
): string {
  if (chapterNumber === undefined || chapterNumber > 3) return "";

  if (language === "en") {
    return `## Literary Opening Discipline — Chapter ${chapterNumber}

This is chapter ${chapterNumber} of the opening three. The serious-literary opening is the opposite of the commercial hook: it does not announce a crisis on the first page, it establishes a voice, a place, a weight. What the reader must feel within the first three chapters is not "I want to know what happens next" but "I trust the hand that is writing this and want to live here for a while."

Chapter 1: install the world's atmosphere — sensory anchor (a smell, a light, a sound that belongs to this place and no other), a glimpse of social texture (one detail of class, generation, or labor), and the protagonist's psychological baseline (their habit of attention — what do they notice, what do they refuse to notice). The thematic field must surface tacitly: the central tension of the work is hinted at through one ordinary act, not declared. **Refuse the dramatic-reversal opening line.** Chapter 2: deepen one relationship and let the social topology widen — the reader should glimpse that this story is not about one hero but about a web of people whose lives press against each other. Chapter 3: the historical/political/ecological pressure that frames the personal story should become palpable; the reader should feel that the private and the public are not separate. Across all three chapters: longer paragraphs are permitted; verbs do the work; adjectives are rationed; concrete nouns of place and labor outnumber abstract emotional words.`;
  }

  return `## 严肃文学开篇纪律 — 第 ${chapterNumber} 章

这是开篇三章中的第 ${chapterNumber} 章。严肃文学的开篇与商业开场相反——它不在第一页宣告危机，它建立一种声音、一种地点、一种重量。读者在三章之内要感受到的不是"我想知道接下来会怎样"，而是"我信任写这本书的人，我愿意在这里待一会儿"。

第 1 章：植入世界的气息——具体的感官锚（一种属于此地的气味、一种光、一种声音）、一个社会纹理的细节（阶级、代际、劳动的某个具体面）、主角的心理基线（他注意什么、他拒绝注意什么）。主题场要在不明说中浮现：作品的核心张力通过一个普通的动作隐隐传递，而不是宣告。**禁止使用戏剧化反转开场句。** 第 2 章：让某一段关系加深，让社会拓扑展开——读者要瞥见这不是一个英雄的故事，而是一张人与人相互挤压的网。第 3 章：让框定个人故事的历史/政治/生态压力变得可触——读者要感到私人生活与公共生活并不分开。贯穿三章的纪律：允许更长的段落；动词承担工作；形容词配额；地点和劳动的具体名词压过抽象情绪词。`;
}

// ---------------------------------------------------------------------------
// 黄金开篇（中文3章/英文5章）
// ---------------------------------------------------------------------------

function buildGoldenChaptersRules(chapterNumber?: number, language?: string): string {
  const isEnglish = language === "en";
  // For literary fiction the "establishing window" is the first three chapters in any language.
  const limit = 3;
  if (chapterNumber === undefined || chapterNumber > limit) return "";

  const zhRules: Record<number, string> = {
    1: `### 第一章：建立声音与世界的气息
- 开篇不必抛出冲突。从一个具体的时刻、一种感官、一个动作进入
- 第一段要让读者闻到、看到、听到——这本书所在的地方，与别处的差别
- 主题场要在不言中浮现：通过主角注意到什么、忽略什么，让读者隐约感到这本书在思考什么
- 主角的身份/处境/历史通过行动和细节带出，禁止资料卡罗列、禁止戏剧化反转的开场句
- 章末不必有悬念；可以是一个意象的余响、一种情绪的悬停、一个未问出的问题`,
    2: `### 第二章：让一段关系加深，让世界拓宽
- 选一段关系（家人、邻里、同事、师徒），通过一次具体场景让它的肌理露出来
- 同时让社会/历史的拓扑稍稍展开——读者要瞥见这不是一个人的故事，而是一群人压在一起过日子
- 配角第一次出场就要立体：让他至少有一个与主角不重合的关切
- 一个核心意象（水、铁、光、灰、某种声音）在本章第一次以无意义的方式出现，为后续的回响埋下种子`,
    3: `### 第三章：让公共压力变得可触
- 框定个人故事的更大力量（历史、制度、阶级、生态、代际）必须在本章变得具体可触
- 主题命题在本章要有第一次正面但克制的折射——通过一个具体事件、一段对话、一个无解的处境
- 主角不必有"目标"。他有的只是一种处境，以及对这种处境的某种默认或反抗
- 章末留下情绪余量，不交代结果`,
  };

  const enRules: Record<number, string> = {
    1: `### Chapter 1: install voice and the breath of the world
- Don't open on conflict. Enter through a concrete moment, a sense, an act
- The first paragraph must let the reader smell, see, hear — the difference between this place and any other
- The thematic field surfaces tacitly: through what the protagonist notices and refuses to notice, the reader half-feels what this book is thinking about
- Identity, situation, and history come through behavior and detail; no info-card dumps; no dramatic-reversal opening line
- The chapter doesn't need a cliff: an echoing image, a held emotion, an unasked question all qualify`,
    2: `### Chapter 2: deepen one relationship; widen the social field
- Pick one relationship (family, neighbor, colleague, mentor) and let its texture show through one concrete scene
- The social/historical topology widens slightly — the reader glimpses that this isn't one person's story, but a press of lives
- Side characters arrive three-dimensional from their first appearance: each has at least one concern that does not overlap with the protagonist's
- A core image (water, iron, light, ash, a sound) makes its first apparently-meaningless appearance, planting a seed for later resonance`,
    3: `### Chapter 3: make the public pressure tangible
- The larger force framing the personal story (history, institution, class, ecology, generation) becomes concretely felt this chapter
- The thematic proposition takes its first overt but restrained refraction — through one specific event, one exchange, one unresolvable situation
- The protagonist need not have a "goal". They have a situation and some posture toward it — acceptance or resistance
- End with emotional residue, not resolution`,
  };

  const rules = isEnglish ? enRules : zhRules;
  const header = isEnglish
    ? `## Establishing Window — Chapter ${chapterNumber} of ${limit}

The first ${limit} chapters establish voice, world, and thematic field. Resist commercial-opening pressure: the goal is not retention through cliffhangers but the reader's trust in the writing's seriousness.

- Begin with a specific moment, not an explosion
- Worldbuilding emerges through detail and action, never as exposition
- Each chapter: at most one location-shift, named characters introduced sparingly
- Public and private lives must be visible as continuous, not separate`
    : `## 开篇建立窗口（第 ${chapterNumber} 章 / 共 ${limit} 章）

开篇 ${limit} 章建立声音、世界与主题场。抵抗商业开场的拉力：目标不是用悬念留住读者，而是让读者信任这本书的严肃。

- 从一个具体的时刻进入，不是从一场爆炸进入
- 世界观通过细节和行动浮现，禁止说明性段落
- 每章最多一次地点切换，有名有姓的人物节制引入
- 公共生活与私人生活要被写成连续的，而不是分开的`;

  return `${header}

${rules[chapterNumber] ?? ""}`;
}

// ---------------------------------------------------------------------------
// Full cast tracking (conditional)
// ---------------------------------------------------------------------------

function buildFullCastTracking(): string {
  return `## 全员追踪

本书启用全员追踪模式。每章结束时，POST_SETTLEMENT 必须额外包含：
- 本章出场角色清单（名字 + 一句话状态变化）
- 角色间关系变动（如有）
- 未出场但被提及的角色（名字 + 提及原因）`;
}

// ---------------------------------------------------------------------------
// Genre-specific rules
// ---------------------------------------------------------------------------

function buildGenreRules(gp: GenreProfile, genreBody: string): string {
  const fatigueLine = gp.fatigueWords.length > 0
    ? `- 高疲劳词（${gp.fatigueWords.join("、")}）单章最多出现1次`
    : "";

  const chapterTypesLine = gp.chapterTypes.length > 0
    ? `动笔前先判断本章类型：\n${gp.chapterTypes.map(t => `- ${t}`).join("\n")}`
    : "";

  const pacingLine = gp.pacingRule
    ? `- 节奏规则：${gp.pacingRule}`
    : "";

  return [
    `## 题材规范（${gp.name}）`,
    fatigueLine,
    pacingLine,
    chapterTypesLine,
    genreBody,
  ].filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Protagonist rules from book_rules
// ---------------------------------------------------------------------------

function buildProtagonistRules(bookRules: BookRules | null): string {
  if (!bookRules?.protagonist) return "";

  const p = bookRules.protagonist;
  const lines = [`## 主角铁律（${p.name}）`];

  if (p.personalityLock.length > 0) {
    lines.push(`\n性格锁定：${p.personalityLock.join("、")}`);
  }
  if (p.behavioralConstraints.length > 0) {
    lines.push("\n行为约束：");
    for (const c of p.behavioralConstraints) {
      lines.push(`- ${c}`);
    }
  }

  if (bookRules.prohibitions.length > 0) {
    lines.push("\n本书禁忌：");
    for (const p of bookRules.prohibitions) {
      lines.push(`- ${p}`);
    }
  }

  if (bookRules.genreLock?.forbidden && bookRules.genreLock.forbidden.length > 0) {
    lines.push(`\n风格禁区：禁止出现${bookRules.genreLock.forbidden.join("、")}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Book rules body (user-written markdown)
// ---------------------------------------------------------------------------

function buildBookRulesBody(body: string): string {
  if (!body) return "";
  return `## 本书专属规则\n\n${body}`;
}

// ---------------------------------------------------------------------------
// Style guide
// ---------------------------------------------------------------------------

function buildStyleGuide(styleGuide: string): string {
  if (!styleGuide || styleGuide === "(文件尚未创建)") return "";
  return `## 文风指南\n\n${styleGuide}`;
}

// ---------------------------------------------------------------------------
// Style fingerprint (Phase 9: C3)
// ---------------------------------------------------------------------------

function buildStyleFingerprint(fingerprint?: string): string {
  if (!fingerprint) return "";
  return `## 文风指纹（模仿目标）

以下是从参考文本中提取的写作风格特征。你的输出必须尽量贴合这些特征：

${fingerprint}`;
}

// ---------------------------------------------------------------------------
// Pre-write checklist
// ---------------------------------------------------------------------------

function buildPreWriteChecklist(book: BookConfig, gp: GenreProfile): string {
  let idx = 1;
  const lines = [
    "## 动笔前必须自问",
    "",
    `${idx++}. 【大纲锚定】本章对应卷纲中的哪个节点/阶段？本章必须推进该节点的剧情，不得跳过或提前消耗后续节点。如果卷纲指定了章节范围，严格遵守节奏。`,
    `${idx++}. 主角此刻利益最大化的选择是什么？`,
    `${idx++}. 这场冲突是谁先动手，为什么非做不可？`,
    `${idx++}. 配角/反派是否有明确诉求、恐惧和反制？行为是否由"过往经历+当前利益+性格底色"驱动？`,
    `${idx++}. 反派当前掌握了哪些已知信息？哪些信息只有读者知道？有无信息越界？`,
    `${idx++}. 章尾是否留了钩子（悬念/伏笔/冲突升级）？`,
  ];

  if (gp.numericalSystem) {
    lines.push(`${idx++}. 本章收益能否落到具体资源、数值增量、地位变化或已回收伏笔？`);
  }

  // 17雷点精华预防
  lines.push(
    `${idx++}. 【流水账检查】本章是否有无冲突的日常流水叙述？如有，加入前因后果或强情绪改造`,
    `${idx++}. 【主线偏离检查】本章是否推进了主线目标？支线是否在2-3章内与核心目标关联？`,
    `${idx++}. 【爽点节奏检查】最近3-5章内是否有小爽点落地？读者的"情绪缺口"是否在积累或释放？`,
    `${idx++}. 【人设崩塌检查】角色行为是否与已建立的性格标签一致？有无无铺垫的突然转变？`,
    `${idx++}. 【视角检查】本章视角是否清晰？同场景内说话人物是否控制在3人以内？`,
    `${idx++}. 如果任何问题答不上来，先补逻辑链，再写正文`,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Creative-only output format (no settlement blocks)
// ---------------------------------------------------------------------------

function buildCreativeOutputFormat(book: BookConfig, gp: GenreProfile, lengthSpec: LengthSpec): string {
  const resourceRow = gp.numericalSystem
    ? "| 当前资源总量 | X | 与账本一致 |\n| 本章预计增量 | +X（来源） | 无增量写+0 |"
    : "";

  const preWriteTable = `=== PRE_WRITE_CHECK ===
（必须输出Markdown表格，全部检查项对齐 chapter_memo 七段，而不是卷纲）
| 检查项 | 本章记录 | 备注 |
|--------|----------|------|
| 当前任务 | 复述 chapter_memo 的「当前任务」并写出本章执行动作 | 必须具体，不能抽象 |
| 读者在等什么 | 本章如何处理「读者此刻在等什么」—制造/延迟/兑现 | 与 memo 一致 |
| 该兑现的 / 暂不掀的 | 本章确认要兑现的伏笔 + 必须压住不掀的底牌 | 引用 memo 原文 |
| 日常/过渡承担任务 | 若有日常/过渡段落，说明各自承担的功能 | 对齐 memo 映射表 |
| 章尾必须发生的改变 | 列出 memo「章尾必须发生的改变」中 1-3 条具体改变 | 必须落地 |
| 不要做 | 复述 memo「不要做」清单 | 正文不得触碰 |
| 上下文范围 | 第X章至第Y章 / 状态卡 / 设定文件 | |
| 当前锚点 | 地点 / 对手 / 收益目标 | 锚点必须具体 |
${resourceRow}| 待回收伏笔 | 用真实 hook_id 填写（无则写 none） | 与伏笔池一致 |
| 本章冲突 | 一句话概括 | |
| 章节类型 | ${gp.chapterTypes.join("/")} | |
| 风险扫描 | OOC/信息越界/设定冲突${gp.powerScaling ? "/战力崩坏" : ""}/节奏/词汇疲劳 | |`;

  return `## 输出格式（严格遵守）

${preWriteTable}

=== CHAPTER_TITLE ===
(章节标题，不含"第X章"。标题必须与已有章节标题不同，不要重复使用相同或相似的标题；若提供了 recent title history 或高频标题词，必须主动避开重复词根和高频意象)

=== CHAPTER_CONTENT ===
(正文内容，目标${lengthSpec.target}字，允许区间${lengthSpec.softMin}-${lengthSpec.softMax}字)

【重要】本次只需输出以上三个区块（PRE_WRITE_CHECK、CHAPTER_TITLE、CHAPTER_CONTENT）。
状态卡、伏笔池、摘要等追踪文件将由后续结算阶段处理，请勿输出。`;
}

// ---------------------------------------------------------------------------
// Output format
// ---------------------------------------------------------------------------

function buildOutputFormat(book: BookConfig, gp: GenreProfile, lengthSpec: LengthSpec): string {
  const resourceRow = gp.numericalSystem
    ? "| 当前资源总量 | X | 与账本一致 |\n| 本章预计增量 | +X（来源） | 无增量写+0 |"
    : "";

  const preWriteTable = `=== PRE_WRITE_CHECK ===
（必须输出Markdown表格，全部检查项对齐 chapter_memo 七段，而不是卷纲）
| 检查项 | 本章记录 | 备注 |
|--------|----------|------|
| 当前任务 | 复述 chapter_memo 的「当前任务」并写出本章执行动作 | 必须具体，不能抽象 |
| 读者在等什么 | 本章如何处理「读者此刻在等什么」—制造/延迟/兑现 | 与 memo 一致 |
| 该兑现的 / 暂不掀的 | 本章确认要兑现的伏笔 + 必须压住不掀的底牌 | 引用 memo 原文 |
| 日常/过渡承担任务 | 若有日常/过渡段落，说明各自承担的功能 | 对齐 memo 映射表 |
| 章尾必须发生的改变 | 列出 memo「章尾必须发生的改变」中 1-3 条具体改变 | 必须落地 |
| 不要做 | 复述 memo「不要做」清单 | 正文不得触碰 |
| 上下文范围 | 第X章至第Y章 / 状态卡 / 设定文件 | |
| 当前锚点 | 地点 / 对手 / 收益目标 | 锚点必须具体 |
${resourceRow}| 待回收伏笔 | 用真实 hook_id 填写（无则写 none） | 与伏笔池一致 |
| 本章冲突 | 一句话概括 | |
| 章节类型 | ${gp.chapterTypes.join("/")} | |
| 风险扫描 | OOC/信息越界/设定冲突${gp.powerScaling ? "/战力崩坏" : ""}/节奏/词汇疲劳 | |`;

  const postSettlement = gp.numericalSystem
    ? `=== POST_SETTLEMENT ===
（如有数值变动，必须输出Markdown表格）
| 结算项 | 本章记录 | 备注 |
|--------|----------|------|
| 资源账本 | 期初X / 增量+Y / 期末Z | 无增量写+0 |
| 重要资源 | 资源名 -> 贡献+Y（依据） | 无写"无" |
| 伏笔变动 | 新增/回收/延后 Hook | 同步更新伏笔池 |`
    : `=== POST_SETTLEMENT ===
（如有伏笔变动，必须输出）
| 结算项 | 本章记录 | 备注 |
|--------|----------|------|
| 伏笔变动 | 新增/回收/延后 Hook | 同步更新伏笔池 |`;

  const updatedLedger = gp.numericalSystem
    ? `\n=== UPDATED_LEDGER ===\n(更新后的完整资源账本，Markdown表格格式)`
    : "";

  return `## 输出格式（严格遵守）

${preWriteTable}

=== CHAPTER_TITLE ===
(章节标题，不含"第X章"。标题必须与已有章节标题不同，不要重复使用相同或相似的标题；若提供了 recent title history 或高频标题词，必须主动避开重复词根和高频意象)

=== CHAPTER_CONTENT ===
(正文内容，目标${lengthSpec.target}字，允许区间${lengthSpec.softMin}-${lengthSpec.softMax}字)

${postSettlement}

=== UPDATED_STATE ===
(更新后的完整状态卡，Markdown表格格式)
${updatedLedger}
=== UPDATED_HOOKS ===
(更新后的完整伏笔池，Markdown表格格式)

=== CHAPTER_SUMMARY ===
(本章摘要，Markdown表格格式，必须包含以下列)
| 章节 | 标题 | 出场人物 | 关键事件 | 状态变化 | 伏笔动态 | 情绪基调 | 章节类型 |
|------|------|----------|----------|----------|----------|----------|----------|
| N | 本章标题 | 角色1,角色2 | 一句话概括 | 关键变化 | H01埋设/H02推进 | 情绪走向 | ${gp.chapterTypes.length > 0 ? gp.chapterTypes.join("/") : "过渡/冲突/高潮/收束"} |

=== UPDATED_SUBPLOTS ===
(更新后的完整支线进度板，Markdown表格格式)
| 支线ID | 支线名 | 相关角色 | 起始章 | 最近活跃章 | 距今章数 | 状态 | 进度概述 | 回收ETA |
|--------|--------|----------|--------|------------|----------|------|----------|---------|

=== UPDATED_EMOTIONAL_ARCS ===
(更新后的完整情感弧线，Markdown表格格式)
| 角色 | 章节 | 情绪状态 | 触发事件 | 强度(1-10) | 弧线方向 |
|------|------|----------|----------|------------|----------|

=== UPDATED_CHARACTER_MATRIX ===
(更新后的角色矩阵，每个角色一个 ## 块)

## 角色名
- **定位**: 主角 / 反派 / 盟友 / 配角 / 提及
- **标签**: 核心身份标签
- **反差**: 打破刻板印象的独特细节
- **说话**: 说话风格概述
- **性格**: 性格底色
- **动机**: 根本驱动力
- **当前**: 本章即时目标
- **关系**: 某角色(关系性质/Ch#) | ...
- **已知**: 该角色已知的信息（仅限亲历或被告知）
- **未知**: 该角色不知道的信息`;
}
