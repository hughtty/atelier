/**
 * Structural AI-tell detection — pure rule-based analysis (no LLM).
 *
 * Tuned for serious-literary writing: AI fingerprints in literary prose
 * differ from web-novel patterns. Categories:
 * - dim 20: Paragraph length uniformity (low variance)
 * - dim 21: Hedge / tentative-language density
 * - dim 22: Formulaic transition repetition
 * - dim 23: List-like sentence-prefix repetition
 * - dim 24: Surprise/dramatic-marker over-use ("突然/忽然/竟然/仿佛" etc.)
 * - dim 25: Analytical-report language ("核心/本质上/某种程度上" etc.)
 * - dim 26: Mechanical parallelism ("不是A而是B"/"不是A，是B" patterns)
 * - dim 27: Narrator-intrusion markers ("显而易见/不言而喻/众所周知" etc.)
 * - dim 28: Em-dash overuse ("——" stacking)
 */

export interface AITellIssue {
  readonly severity: "warning" | "info";
  readonly category: string;
  readonly description: string;
  readonly suggestion: string;
}

export interface AITellResult {
  readonly issues: ReadonlyArray<AITellIssue>;
}

type AITellLanguage = "zh" | "en";

const HEDGE_WORDS: Record<AITellLanguage, ReadonlyArray<string>> = {
  zh: [
    "似乎", "可能", "或许", "大概", "大致", "大体上",
    "某种程度上", "一定程度上", "在某种意义上", "在某种程度上",
    "总的来说", "总体而言", "或多或少",
  ],
  en: [
    "seems", "seemed", "perhaps", "maybe", "apparently",
    "in some ways", "to some extent", "more or less",
    "by and large", "roughly speaking",
  ],
};

const TRANSITION_WORDS: Record<AITellLanguage, ReadonlyArray<string>> = {
  zh: [
    "然而", "不过", "与此同时", "另一方面", "尽管如此", "话虽如此",
    "但值得注意的是", "值得注意的是", "值得一提的是",
    "因此", "于是", "所以", "此外", "再者",
    "综上所述", "总而言之", "简而言之", "换言之",
  ],
  en: [
    "however", "meanwhile", "on the other hand", "nevertheless",
    "even so", "still", "moreover", "furthermore",
    "in conclusion", "in summary", "in other words", "that said",
  ],
};

// Surprise/dramatic markers — over-used by LLMs to manufacture intensity.
// Literary prose earns surprise through specificity, not signal words.
const SURPRISE_MARKERS: Record<AITellLanguage, ReadonlyArray<string>> = {
  zh: [
    "突然", "忽然", "猛地", "猛然", "陡然",
    "竟然", "居然", "竟", "不禁",
    "仿佛", "宛如", "犹如", "好似",
    "就在这时", "就在此时", "正当此时", "刹那间", "瞬间",
  ],
  en: [
    "suddenly", "abruptly", "all of a sudden",
    "as if", "as though", "like a", "much like",
    "in that moment", "at that very moment", "in an instant",
  ],
};

// Analytical / report-style vocabulary — destroys fictional intimacy.
// These belong in essays, not in literary prose.
const ANALYTICAL_LANGUAGE: Record<AITellLanguage, ReadonlyArray<string>> = {
  zh: [
    "核心", "本质上", "从根本上说", "归根结底", "归根到底",
    "关键在于", "重点在于", "问题在于",
    "从某种角度来看", "从某种意义上",
    "客观上", "主观上", "实际上", "事实上", "本质",
    "深层次", "深层次的", "深层次地",
  ],
  en: [
    "essentially", "fundamentally", "in essence",
    "the core of", "the key point", "the crucial",
    "objectively speaking", "in reality", "in fact",
    "at a deeper level", "on a fundamental level",
  ],
};

// Narrator-intrusion markers — author stepping in to summarize meaning for the reader.
// In serious literary writing this is a sin: trust the reader to feel.
const NARRATOR_INTRUSION_MARKERS: Record<AITellLanguage, ReadonlyArray<string>> = {
  zh: [
    "显而易见", "显然", "不言而喻", "不难看出", "不难发现",
    "众所周知", "毋庸置疑", "无可否认", "不可否认",
    "可以说", "可以这么说", "甚至可以说",
    "正因如此", "由此可见", "由此可知",
    "这意味着", "这表明", "这说明",
  ],
  en: [
    "obviously", "evidently", "needless to say",
    "it is clear that", "it goes without saying",
    "undeniably", "indubitably",
    "this means that", "this shows that", "this proves that",
  ],
};

function countMatches(content: string, words: ReadonlyArray<string>, isEnglish: boolean): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const word of words) {
    const regex = new RegExp(escapeRegex(word), isEnglish ? "gi" : "g");
    const matches = content.match(regex);
    const count = matches?.length ?? 0;
    if (count > 0) {
      counts[isEnglish ? word.toLowerCase() : word] = count;
    }
  }
  return counts;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function totalCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/**
 * Analyze text content for structural AI-tell patterns.
 * Returns issues that can be merged into audit results.
 */
export function analyzeAITells(content: string, language: AITellLanguage = "zh"): AITellResult {
  const issues: AITellIssue[] = [];
  const isEnglish = language === "en";
  const joiner = isEnglish ? ", " : "、";

  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // dim 20: Paragraph length uniformity
  if (paragraphs.length >= 3) {
    const paragraphLengths = paragraphs.map((p) => p.length);
    const mean = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length;
    if (mean > 0) {
      const variance = paragraphLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / paragraphLengths.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / mean;
      if (cv < 0.15) {
        issues.push({
          severity: "warning",
          category: isEnglish ? "Paragraph uniformity" : "段落等长",
          description: isEnglish
            ? `Paragraph-length coefficient of variation is only ${cv.toFixed(3)} (threshold <0.15), suggesting unnaturally uniform sizing`
            : `段落长度变异系数仅 ${cv.toFixed(3)}（阈值 <0.15），段落长度过于均匀，呈现 AI 生成特征`,
          suggestion: isEnglish
            ? "Vary paragraph weight by what each does — short for impact, long for immersion or breath"
            : "增加段落长度差异：短段落承担节奏冲击，长段落承担呼吸与浸入",
        });
      }
    }
  }

  // dim 21: Hedge density (>3 per 1k chars)
  const totalChars = content.length;
  if (totalChars > 0) {
    const hedgeCounts = countMatches(content, HEDGE_WORDS[language], isEnglish);
    const hedgeTotal = totalCount(hedgeCounts);
    const hedgeDensity = hedgeTotal / (totalChars / 1000);
    if (hedgeDensity > 3) {
      issues.push({
        severity: "warning",
        category: isEnglish ? "Hedge density" : "套话密度",
        description: isEnglish
          ? `Hedge-word density is ${hedgeDensity.toFixed(1)} per 1k characters (threshold >3), making the prose tentative`
          : `套话词（似乎/可能/或许等）密度为 ${hedgeDensity.toFixed(1)} 次/千字（阈值 >3），语气过于模糊犹豫`,
        suggestion: isEnglish
          ? "Replace hedges with firmer narration; let concrete detail carry uncertainty if needed"
          : "用确定性叙述替代模糊表达；若需要保留不确定性，让具体细节自身承担它",
      });
    }
  }

  // dim 22: Formulaic transition repetition (any single transition ≥3 times)
  const transitionCounts = countMatches(content, TRANSITION_WORDS[language], isEnglish);
  const repeatedTransitions = Object.entries(transitionCounts).filter(([, count]) => count >= 3);
  if (repeatedTransitions.length > 0) {
    const detail = repeatedTransitions.map(([w, c]) => `"${w}"×${c}`).join(joiner);
    issues.push({
      severity: "warning",
      category: isEnglish ? "Formulaic transitions" : "公式化转折",
      description: isEnglish
        ? `Transition words repeat too often: ${detail}. Same-transition reuse 3+ times creates a formulaic AI texture`
        : `转折词重复使用：${detail}。同一转折模式 ≥3 次暴露 AI 生成痕迹`,
      suggestion: isEnglish
        ? "Let scenes pivot through action, timing, or viewpoint shifts instead of repeated transition words"
        : "用情节、时间或视角的自然切换替代转折词；严肃文学应让句意自然衔接",
    });
  }

  // dim 23: List-like structure (consecutive same-prefix sentences)
  const sentences = content
    .split(isEnglish ? /[.!?\n]/ : /[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  if (sentences.length >= 3) {
    let consecutive = 1;
    let maxConsecutive = 1;
    for (let i = 1; i < sentences.length; i++) {
      const prevPrefix = isEnglish
        ? sentences[i - 1]!.split(/\s+/)[0]?.toLowerCase() ?? ""
        : sentences[i - 1]!.slice(0, 2);
      const currPrefix = isEnglish
        ? sentences[i]!.split(/\s+/)[0]?.toLowerCase() ?? ""
        : sentences[i]!.slice(0, 2);
      if (prevPrefix === currPrefix) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 1;
      }
    }
    if (maxConsecutive >= 3) {
      issues.push({
        severity: "info",
        category: isEnglish ? "List-like structure" : "列表式结构",
        description: isEnglish
          ? `Detected ${maxConsecutive} consecutive sentences with the same opening pattern — list-like cadence`
          : `检测到 ${maxConsecutive} 句连续以相同开头的句子，呈现列表式 AI 生成结构`,
        suggestion: isEnglish
          ? "Vary how sentences open — change subject, timing, or action entry to break the list effect"
          : "变换句式开头：用不同主语、时间词、动作词开头，打破列表感",
      });
    }
  }

  // dim 24: Surprise / dramatic-marker over-use (>1 per 3000 chars in literary register)
  if (totalChars >= 1000) {
    const surpriseCounts = countMatches(content, SURPRISE_MARKERS[language], isEnglish);
    const surpriseTotal = totalCount(surpriseCounts);
    const allowed = Math.max(1, Math.ceil(totalChars / 3000));
    if (surpriseTotal > allowed) {
      const detail = Object.entries(surpriseCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([w, c]) => `"${w}"×${c}`)
        .join(joiner);
      issues.push({
        severity: "warning",
        category: isEnglish ? "Surprise-marker overuse" : "戏剧化标记词滥用",
        description: isEnglish
          ? `Surprise/dramatic markers used ${surpriseTotal} times (literary cap ≈ ${allowed} per ${Math.ceil(totalChars / 1000)}k chars): ${detail}`
          : `戏剧化标记词共 ${surpriseTotal} 次（文学性上限约 ${allowed} 次 / ${Math.ceil(totalChars / 1000)}k 字）：${detail}`,
        suggestion: isEnglish
          ? "Earn surprise through specificity. Cut the marker; let the concrete event carry the shock"
          : "让出乎意料通过具体细节自然产生。删掉标记词，让事件本身承担冲击",
      });
    }
  }

  // dim 25: Analytical-report language inside narrative
  if (totalChars > 0) {
    const analyticalCounts = countMatches(content, ANALYTICAL_LANGUAGE[language], isEnglish);
    const analyticalTotal = totalCount(analyticalCounts);
    if (analyticalTotal >= 3) {
      const detail = Object.entries(analyticalCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([w, c]) => `"${w}"×${c}`)
        .join(joiner);
      issues.push({
        severity: "warning",
        category: isEnglish ? "Analytical-report register" : "分析报告体",
        description: isEnglish
          ? `Analytical/essayistic vocabulary appears ${analyticalTotal} times: ${detail}. Literary prose should not read as commentary on itself`
          : `分析评论式词汇共 ${analyticalTotal} 次：${detail}。严肃文学的叙事不应像在评论自己`,
        suggestion: isEnglish
          ? "Strip these words; show the situation through action, image, or silence and trust the reader"
          : "删掉这些词；通过行为、意象或沉默让读者自行判断",
      });
    }
  }

  // dim 26: Mechanical parallelism — "不是X，是Y" / "不是X而是Y" / "with not X but Y"
  if (!isEnglish) {
    const patterns = [
      /不是[^，。.\n]{1,40}而是/g,
      /不是[^，。.\n]{1,40}，[^。\n]{0,3}是/g,
      /与其说[^，。.\n]{1,40}不如说/g,
    ];
    let parallelCount = 0;
    for (const p of patterns) {
      const matches = content.match(p);
      parallelCount += matches?.length ?? 0;
    }
    if (parallelCount >= 2) {
      issues.push({
        severity: "warning",
        category: "机械对仗",
        description: `检测到 ${parallelCount} 处 "不是...而是..." / "不是...，是..." / "与其说...不如说..." 工整对仗。这种句式连用 ≥2 次是 AI 生成的强信号`,
        suggestion: "改用直述句或让人物自身判断；机械对仗在严肃文学中应严格限额",
      });
    }
  } else {
    const matches = content.match(/\bnot\s+[a-z\s]{1,30}\bbut\s+/gi);
    const parallelCount = matches?.length ?? 0;
    if (parallelCount >= 3) {
      issues.push({
        severity: "warning",
        category: "Mechanical parallelism",
        description: `Detected ${parallelCount} occurrences of "not X but Y" parallel structure — repeated mechanical parallelism is a strong AI tell`,
        suggestion: "Vary the construction; let direct statement or character judgment carry the contrast",
      });
    }
  }

  // dim 27: Narrator-intrusion markers (any ≥2 occurrences)
  if (totalChars > 0) {
    const intrusionCounts = countMatches(content, NARRATOR_INTRUSION_MARKERS[language], isEnglish);
    const intrusionTotal = totalCount(intrusionCounts);
    if (intrusionTotal >= 2) {
      const detail = Object.entries(intrusionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([w, c]) => `"${w}"×${c}`)
        .join(joiner);
      issues.push({
        severity: "warning",
        category: isEnglish ? "Narrator intrusion" : "叙述者越界",
        description: isEnglish
          ? `Narrator-intrusion markers appear ${intrusionTotal} times: ${detail}. The narrator is summarizing meaning the reader should derive`
          : `叙述者越界标记共 ${intrusionTotal} 次：${detail}。叙述者在替读者下结论，违反"读者智商在线"原则`,
        suggestion: isEnglish
          ? "Delete these markers; let the scene mean what it means, the reader will follow"
          : "删除这些标记；让场景自身承担含义，相信读者",
      });
    }
  }

  // dim 28: Em-dash overuse (literary prose can use em-dash but not as default punctuation)
  const emDashMatches = content.match(/——/g);
  const emDashCount = emDashMatches?.length ?? 0;
  if (emDashCount > 5 || (totalChars > 1000 && emDashCount / (totalChars / 1000) > 2)) {
    issues.push({
      severity: "info",
      category: isEnglish ? "Em-dash overuse" : "破折号滥用",
      description: isEnglish
        ? `"——" used ${emDashCount} times (${(emDashCount / (totalChars / 1000)).toFixed(1)} per 1k chars). Excessive em-dash use is a known LLM tic`
        : `"——" 共 ${emDashCount} 次（${(emDashCount / (totalChars / 1000)).toFixed(1)} 次/千字）。破折号过密是 AI 生成的常见痕迹`,
      suggestion: isEnglish
        ? "Replace most em-dashes with comma or period; reserve em-dash for genuine syntactic break"
        : "多数破折号改为逗号或句号；只在真正需要语法断裂处保留",
    });
  }

  return { issues };
}
