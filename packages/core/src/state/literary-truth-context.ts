/**
 * Literary truth-context loader.
 *
 * Reads the 6 Atelier literary truth files for a book and formats them as a
 * compact markdown section that Writer / Planner / Auditor agents can inject
 * into their system prompts.
 *
 * Two output modes:
 *   - "full"     — all truth files, in full, for low-pressure context (e.g. Architect)
 *   - "writing"  — compact summary tuned for per-chapter Writer/Planner calls
 *
 * When a truth file is missing the section is silently omitted. When *all* are
 * missing this loader returns an empty string and the caller can decide how to
 * surface that to the user (e.g. a Doctor warning).
 */

import {
  readThematicFramework,
  readCharacterPsychology,
  readSymbolicNetwork,
  readSocialTopology,
  readNarrativeRhythm,
  readHistoricalContext,
} from "./literary-truth-store.js";
import type {
  ThematicFramework,
  CharacterPsychology,
  SymbolicNetwork,
  SocialTopology,
  NarrativeRhythm,
  HistoricalContext,
} from "../models/literary-truth-files.js";

export interface LiteraryTruthBundle {
  readonly thematic: ThematicFramework | null;
  readonly characters: CharacterPsychology | null;
  readonly symbols: SymbolicNetwork | null;
  readonly social: SocialTopology | null;
  readonly rhythm: NarrativeRhythm | null;
  readonly historical: HistoricalContext | null;
}

export interface LiteraryTruthSummary {
  readonly bundle: LiteraryTruthBundle;
  readonly availability: Readonly<Record<keyof LiteraryTruthBundle, boolean>>;
  readonly missingFiles: ReadonlyArray<keyof LiteraryTruthBundle>;
  readonly anyPresent: boolean;
}

export type TruthContextMode = "full" | "writing";

export async function loadLiteraryTruthBundle(
  projectRoot: string,
  bookId: string,
): Promise<LiteraryTruthSummary> {
  const [thematic, characters, symbols, social, rhythm, historical] = await Promise.all([
    readThematicFramework(projectRoot, bookId),
    readCharacterPsychology(projectRoot, bookId),
    readSymbolicNetwork(projectRoot, bookId),
    readSocialTopology(projectRoot, bookId),
    readNarrativeRhythm(projectRoot, bookId),
    readHistoricalContext(projectRoot, bookId),
  ]);

  const bundle: LiteraryTruthBundle = { thematic, characters, symbols, social, rhythm, historical };
  const availability = {
    thematic: thematic !== null,
    characters: characters !== null,
    symbols: symbols !== null,
    social: social !== null,
    rhythm: rhythm !== null,
    historical: historical !== null,
  } as const;
  const missingFiles = (Object.entries(availability) as Array<[keyof LiteraryTruthBundle, boolean]>)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  const anyPresent = Object.values(availability).some(Boolean);
  return { bundle, availability, missingFiles, anyPresent };
}

/**
 * Format a truth bundle as a compact prompt section. Returns "" if all six
 * files are missing — caller can short-circuit injection.
 */
export function formatLiteraryTruthContext(
  summary: LiteraryTruthSummary,
  options: { readonly mode: TruthContextMode; readonly language: "zh" | "en"; readonly chapterNumber?: number } = {
    mode: "writing",
    language: "zh",
  },
): string {
  if (!summary.anyPresent) return "";
  const { bundle } = summary;
  const isEn = options.language === "en";
  const header = isEn
    ? "## Story bible (Atelier truth files — internalize, never quote literally)"
    : "## 创作圣经（Atelier 真相文件 — 内化，绝不字面引用）";

  const sections: string[] = [header];

  if (bundle.thematic) sections.push(formatThematic(bundle.thematic, isEn, options.mode));
  if (bundle.characters) sections.push(formatCharacters(bundle.characters, isEn, options.mode, options.chapterNumber));
  if (bundle.symbols) sections.push(formatSymbols(bundle.symbols, isEn, options.mode));
  if (bundle.social) sections.push(formatSocial(bundle.social, isEn, options.mode));
  if (bundle.historical) sections.push(formatHistorical(bundle.historical, isEn, options.mode));
  if (bundle.rhythm) sections.push(formatRhythm(bundle.rhythm, isEn, options.mode, options.chapterNumber));

  return sections.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Per-file formatters
// ---------------------------------------------------------------------------

function formatThematic(t: ThematicFramework, isEn: boolean, mode: TruthContextMode): string {
  const lines: string[] = [];
  lines.push(isEn ? "### Theme" : "### 主题");
  lines.push(`- ${isEn ? "Core" : "核心命题"}: ${t.core_proposition}`);
  if (t.thematic_question) lines.push(`- ${isEn ? "Driving question" : "驱动问题"}: ${t.thematic_question}`);
  if (t.value_tensions.length > 0) {
    lines.push(`- ${isEn ? "Value tensions" : "价值张力"}:`);
    for (const v of t.value_tensions) {
      lines.push(`  - ${v.pole_a} ↔ ${v.pole_b}${mode === "full" ? `: ${v.description}` : ""}`);
    }
  }
  if (mode === "full" && t.thematic_variations.length > 0) {
    lines.push(`- ${isEn ? "Variations" : "变奏"}:`);
    for (const v of t.thematic_variations) {
      lines.push(`  - ${isEn ? "Ch" : "章"} ${v.chapter_range} via ${v.perspective}: ${v.refraction}`);
    }
  }
  if (t.ending_posture) lines.push(`- ${isEn ? "Ending posture" : "结局姿态"}: ${t.ending_posture}`);
  if (t.forbidden_resolutions.length > 0) {
    lines.push(`- ${isEn ? "Forbidden resolutions" : "禁忌解"}:`);
    for (const r of t.forbidden_resolutions) lines.push(`  - ${r}`);
  }
  return lines.join("\n");
}

function formatCharacters(
  c: CharacterPsychology,
  isEn: boolean,
  mode: TruthContextMode,
  chapterNumber?: number,
): string {
  const lines: string[] = [];
  lines.push(isEn ? "### Characters" : "### 人物心理地图");
  // In writing mode keep protagonists + co-leads + ensemble; minor only if full.
  const tiers = mode === "full"
    ? ["protagonist", "co-lead", "ensemble", "minor"]
    : ["protagonist", "co-lead", "ensemble"];
  const filtered = c.characters.filter((ch) => tiers.includes(ch.tier));
  for (const ch of filtered) {
    lines.push(`- **${ch.name}** (${ch.tier}${ch.age_range ? `, ${ch.age_range}` : ""}${ch.social_position ? `, ${ch.social_position}` : ""})`);
    lines.push(`  - ${isEn ? "Contradiction" : "矛盾性"}: ${ch.contradiction}`);
    lines.push(`  - ${isEn ? "Attention habit" : "注意习惯"}: ${ch.habit_of_attention}`);
    if (mode === "full") {
      const po = ch.psychological_origin;
      lines.push(`  - ${isEn ? "Formative event" : "塑形事件"}: ${po.formative_event}`);
      if (po.family_pattern) lines.push(`  - ${isEn ? "Family pattern" : "家族模式"}: ${po.family_pattern}`);
      if (po.unresolved) lines.push(`  - ${isEn ? "Unresolved" : "未化解"}: ${po.unresolved}`);
    }
    // Show only arc beats relevant to current chapter when chapter number known
    if (chapterNumber !== undefined && ch.arc_beats.length > 0) {
      const relevant = ch.arc_beats.filter((b) => isChapterInMarker(chapterNumber, b.chapter_marker));
      const beatsToShow = relevant.length > 0 ? relevant : ch.arc_beats.slice(0, 1);
      for (const b of beatsToShow) {
        lines.push(`  - ${isEn ? "Arc beat" : "弧光"} (${b.chapter_marker}): ${b.inner_state} → ${b.visible_change}`);
      }
    }
    if (ch.voice_profile) lines.push(`  - ${isEn ? "Voice" : "声音"}: ${ch.voice_profile}`);
  }
  if (c.ensemble_balance_note) {
    lines.push(`- ${isEn ? "Ensemble balance" : "群像平衡"}: ${c.ensemble_balance_note}`);
  }
  return lines.join("\n");
}

function formatSymbols(s: SymbolicNetwork, isEn: boolean, mode: TruthContextMode): string {
  const lines: string[] = [];
  lines.push(isEn ? "### Image network" : "### 意象网络");
  for (const img of s.core_images) {
    const state = img.current_state;
    lines.push(`- ${img.image} (${img.domain}, state=${state}) — ${img.thematic_link}`);
    if (mode === "full" && img.trajectory) lines.push(`  - ${isEn ? "Trajectory" : "演变"}: ${img.trajectory}`);
  }
  if (Object.keys(s.color_palette).length > 0) {
    lines.push(`- ${isEn ? "Colors" : "色彩"}: ${Object.entries(s.color_palette).map(([k, v]) => `${k}→${v}`).join("; ")}`);
  }
  if (Object.keys(s.space_symbolism).length > 0) {
    lines.push(`- ${isEn ? "Spaces" : "空间"}: ${Object.entries(s.space_symbolism).map(([k, v]) => `${k}→${v}`).join("; ")}`);
  }
  if (Object.keys(s.action_metaphors).length > 0) {
    lines.push(`- ${isEn ? "Actions" : "动作"}: ${Object.entries(s.action_metaphors).map(([k, v]) => `${k}→${v}`).join("; ")}`);
  }
  if (s.network_constraint) lines.push(`- ${isEn ? "Constraint" : "约束"}: ${s.network_constraint}`);
  return lines.join("\n");
}

function formatSocial(s: SocialTopology, isEn: boolean, mode: TruthContextMode): string {
  const lines: string[] = [];
  lines.push(isEn ? "### Social topology" : "### 社会拓扑");
  lines.push(`- ${isEn ? "Economic" : "经济"}: ${s.economic.description}`);
  if (s.economic.scarcities.length > 0) lines.push(`  - ${isEn ? "Scarcities" : "匮乏"}: ${s.economic.scarcities.join("; ")}`);
  if (mode === "full" && Object.keys(s.economic.cost_anchors).length > 0) {
    lines.push(`  - ${isEn ? "Cost anchors" : "物价锚点"}: ${Object.entries(s.economic.cost_anchors).map(([k, v]) => `${k}=${v}`).join("; ")}`);
  }
  if (s.power.formal_powers.length > 0) lines.push(`- ${isEn ? "Formal power" : "正式权力"}: ${s.power.formal_powers.join("; ")}`);
  if (s.power.informal_powers.length > 0) lines.push(`- ${isEn ? "Informal power" : "非正式权力"}: ${s.power.informal_powers.join("; ")}`);
  if (mode === "full" && s.power.pressure_paths.length > 0) {
    lines.push(`- ${isEn ? "Pressure paths" : "压力传导"}: ${s.power.pressure_paths.join("; ")}`);
  }
  if (s.culture.rituals.length > 0) lines.push(`- ${isEn ? "Rituals" : "仪式"}: ${s.culture.rituals.join("; ")}`);
  if (s.culture.generational_gaps) lines.push(`- ${isEn ? "Generational gap" : "代际差异"}: ${s.culture.generational_gaps}`);
  if (s.culture.language_layers.length > 0) lines.push(`- ${isEn ? "Language layers" : "语言层次"}: ${s.culture.language_layers.join("; ")}`);
  if (s.geography.primary_locations.length > 0) lines.push(`- ${isEn ? "Locations" : "空间"}: ${s.geography.primary_locations.join("; ")}`);
  if (s.geography.spatial_pressure) lines.push(`- ${isEn ? "Spatial pressure" : "空间压力"}: ${s.geography.spatial_pressure}`);
  return lines.join("\n");
}

function formatHistorical(h: HistoricalContext, isEn: boolean, mode: TruthContextMode): string {
  const lines: string[] = [];
  lines.push(isEn ? "### Historical context" : "### 历史语境");
  lines.push(`- ${isEn ? "Era" : "年代"}: ${h.era_range}`);
  lines.push(`- ${isEn ? "Setting" : "地点"}: ${h.primary_setting}`);
  if (h.social_mood) lines.push(`- ${isEn ? "Social mood" : "时代情绪"}: ${h.social_mood}`);
  if (mode === "full" && h.policy_anchors.length > 0) {
    lines.push(`- ${isEn ? "Policy anchors" : "政策锚点"}:`);
    for (const p of h.policy_anchors) lines.push(`  - ${p.year} ${p.event}: ${p.impact_on_lives}`);
  }
  if (mode === "full" && Object.keys(h.material_anchors).length > 0) {
    lines.push(`- ${isEn ? "Material anchors" : "物质锚点"}: ${Object.entries(h.material_anchors).map(([k, v]) => `${k}=${v}`).join("; ")}`);
  }
  if (h.anachronism_guard.length > 0) {
    lines.push(`- ${isEn ? "Anachronism guard (NEVER write)" : "时代错位防护（绝不写）"}: ${h.anachronism_guard.join("; ")}`);
  }
  return lines.join("\n");
}

function formatRhythm(
  r: NarrativeRhythm,
  isEn: boolean,
  mode: TruthContextMode,
  chapterNumber?: number,
): string {
  const lines: string[] = [];
  lines.push(isEn ? "### Narrative rhythm" : "### 叙事节奏");
  if (r.volume_curve) lines.push(`- ${isEn ? "Volume curve" : "卷情绪曲线"}: ${r.volume_curve}`);
  if (r.silence_policy) lines.push(`- ${isEn ? "Silence policy" : "留白原则"}: ${r.silence_policy}`);
  // Show rhythm for the current chapter, plus optionally the one before and after
  const allRhythms = r.chapter_rhythms;
  const relevant = chapterNumber !== undefined
    ? allRhythms.filter((cr) => isChapterInMarker(chapterNumber, cr.chapter_marker))
    : (mode === "full" ? allRhythms : allRhythms.slice(0, 3));
  if (relevant.length > 0) {
    lines.push(`- ${isEn ? "Chapter rhythms (relevant)" : "本卷章节节奏"}:`);
    for (const cr of relevant) {
      const breathing = cr.breathing_points.length > 0 ? ` | ${isEn ? "breathing" : "换气"}: ${cr.breathing_points.join("; ")}` : "";
      lines.push(`  - ${cr.chapter_marker} (${isEn ? "density" : "密度"}=${cr.density}, ${isEn ? "intensity" : "强度"}=${cr.intensity_level}): ${cr.emotional_arc}${breathing}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Test whether `chapter` falls inside a chapter_marker string like "1-3",
 * "5", "12-15", or a freeform descriptive value like "开篇". Numeric
 * comparison is best-effort; non-numeric markers always pass (so descriptive
 * arc beats are shown).
 */
function isChapterInMarker(chapter: number, marker: string): boolean {
  const m = marker.trim();
  // pure number "5"
  if (/^\d+$/.test(m)) return parseInt(m, 10) === chapter;
  // range "3-7" or "3—7" or "3~7"
  const range = m.match(/^(\d+)\s*[-—~~]\s*(\d+)$/);
  if (range) {
    const lo = parseInt(range[1]!, 10);
    const hi = parseInt(range[2]!, 10);
    return chapter >= lo && chapter <= hi;
  }
  // freeform marker — show by default
  return true;
}
