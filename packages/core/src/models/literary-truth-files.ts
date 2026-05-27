/**
 * Atelier literary truth-file schemas.
 *
 * These are the 6 long-term-memory artifacts that define a serious-literary
 * project's identity and constraints. Together with the existing
 * `chapter_summaries` (from runtime-state), they form Atelier's 7-truth-file
 * model:
 *
 *   1. thematic_framework      — core proposition, value tensions, variations
 *   2. character_psychology    — psychological origins, arc beats, relations
 *   3. symbolic_network        — core images, color/space/action symbolism
 *   4. social_topology         — economic, power, cultural, spatial structure
 *   5. narrative_rhythm        — emotional curve, breathing points, density
 *   6. historical_context      — era, policies, mood, anachronism guard
 *   (7. chapter_summaries — see runtime-state.ts)
 *
 * All schemas are Zod-validated; markdown projections are derived for human
 * reading but JSON is authoritative.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. Thematic Framework
// ---------------------------------------------------------------------------

export const ValueTensionSchema = z.object({
  pole_a: z.string(),
  pole_b: z.string(),
  description: z.string(),
});
export type ValueTension = z.infer<typeof ValueTensionSchema>;

export const ThematicVariationSchema = z.object({
  chapter_range: z.string(), // e.g. "1-3", "4-7"
  perspective: z.string(),   // 通过谁/什么折射
  refraction: z.string(),    // 这一段折射出主题的哪一面
});
export type ThematicVariation = z.infer<typeof ThematicVariationSchema>;

export const ThematicFrameworkSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  core_proposition: z.string(), // 本作核心命题（一句话）
  thematic_question: z.string(), // 引发命题的具体问题
  value_tensions: z.array(ValueTensionSchema).default([]),
  thematic_variations: z.array(ThematicVariationSchema).default([]),
  ending_posture: z.string().optional(), // 结局承认什么样的丧失
  forbidden_resolutions: z.array(z.string()).default([]), // 必须避免的简化解
  notes: z.string().optional(),
});
export type ThematicFramework = z.infer<typeof ThematicFrameworkSchema>;

// ---------------------------------------------------------------------------
// 2. Character Psychology
// ---------------------------------------------------------------------------

export const PsychologicalOriginSchema = z.object({
  formative_event: z.string(),     // 童年/早年塑形事件
  family_pattern: z.string(),      // 家族传递的模式
  class_imprint: z.string().optional(), // 阶级烙印
  unresolved: z.string().optional(),    // 未化解的核心情结
});
export type PsychologicalOrigin = z.infer<typeof PsychologicalOriginSchema>;

export const ArcBeatSchema = z.object({
  chapter_marker: z.string(),  // 大致章节锚点
  inner_state: z.string(),     // 那一阶段的心理姿态
  visible_change: z.string(),  // 外在可见的变化
});
export type ArcBeat = z.infer<typeof ArcBeatSchema>;

export const RelationDynamicsSchema = z.object({
  with_character: z.string(),      // 对象人物 id 或名字
  baseline: z.string(),             // 关系基线
  current_pressure: z.string(),     // 当前张力
  unsayable: z.string().optional(), // 永远无法说出口的部分
});
export type RelationDynamics = z.infer<typeof RelationDynamicsSchema>;

export const CharacterCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(["protagonist", "co-lead", "ensemble", "minor"]).default("ensemble"),
  age_range: z.string().optional(),
  social_position: z.string().optional(),
  psychological_origin: PsychologicalOriginSchema,
  contradiction: z.string(), // 核心矛盾性（不是"标签 + 反差"，是真实的内部撕扯）
  habit_of_attention: z.string(), // 他/她注意什么、拒绝注意什么
  arc_beats: z.array(ArcBeatSchema).default([]),
  relations: z.array(RelationDynamicsSchema).default([]),
  voice_profile: z.string().optional(), // 语言习惯、句长偏好、口头禅、方言痕迹
  notes: z.string().optional(),
});
export type CharacterCard = z.infer<typeof CharacterCardSchema>;

export const CharacterPsychologySchema = z.object({
  schemaVersion: z.literal(1).default(1),
  characters: z.array(CharacterCardSchema).default([]),
  ensemble_balance_note: z.string().optional(), // 群像平衡说明（哪几个配角必须有独立心理弧）
});
export type CharacterPsychology = z.infer<typeof CharacterPsychologySchema>;

// ---------------------------------------------------------------------------
// 3. Symbolic Network
// ---------------------------------------------------------------------------

export const ImageNodeSchema = z.object({
  id: z.string(),
  image: z.string(),                  // 具体意象（一口井、一棵杉树、一首歌）
  domain: z.enum(["nature", "object", "sound", "color", "space", "action", "smell"]),
  thematic_link: z.string(),          // 与主题的关联
  first_appearance: z.string().optional(), // 第一次出现的位置/时机
  current_state: z.enum(["seeded", "echoed", "transformed", "silent"]).default("seeded"),
  trajectory: z.string().optional(), // 计划的演变轨迹
});
export type ImageNode = z.infer<typeof ImageNodeSchema>;

export const SymbolicNetworkSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  core_images: z.array(ImageNodeSchema).default([]),
  color_palette: z.record(z.string()).default({}),  // 色彩 → 含义
  space_symbolism: z.record(z.string()).default({}), // 空间 → 含义（如 "厨房" → 沟通失败的剧场）
  action_metaphors: z.record(z.string()).default({}), // 动作 → 含义
  network_constraint: z.string().optional(), // 网络约束规则（同一意象不连续渲染>2 次）
});
export type SymbolicNetwork = z.infer<typeof SymbolicNetworkSchema>;

// ---------------------------------------------------------------------------
// 4. Social Topology
// ---------------------------------------------------------------------------

export const EconomicLayerSchema = z.object({
  description: z.string(),
  income_brackets: z.array(z.string()).default([]),
  cost_anchors: z.record(z.string()).default({}), // 物价/房租/工资等基准
  scarcities: z.array(z.string()).default([]),
});
export type EconomicLayer = z.infer<typeof EconomicLayerSchema>;

export const PowerNetworkSchema = z.object({
  formal_powers: z.array(z.string()).default([]),  // 正式权力（政府、单位、机构）
  informal_powers: z.array(z.string()).default([]), // 非正式权力（宗族、人脉、潜规则）
  pressure_paths: z.array(z.string()).default([]),  // 主要的压力传导路径
});
export type PowerNetwork = z.infer<typeof PowerNetworkSchema>;

export const CulturalSystemSchema = z.object({
  values: z.array(z.string()).default([]),
  rituals: z.array(z.string()).default([]),       // 葬礼/年节/婚事的具体形式
  generational_gaps: z.string().optional(),
  language_layers: z.array(z.string()).default([]), // 方言、阶级用语、行话
});
export type CulturalSystem = z.infer<typeof CulturalSystemSchema>;

export const SpatialGeographySchema = z.object({
  primary_locations: z.array(z.string()).default([]),
  spatial_pressure: z.string().optional(), // 空间施加的具体压力（拥挤、隔离、距离）
  movement_patterns: z.array(z.string()).default([]), // 通勤、迁徙、流离的模式
});
export type SpatialGeography = z.infer<typeof SpatialGeographySchema>;

export const SocialTopologySchema = z.object({
  schemaVersion: z.literal(1).default(1),
  economic: EconomicLayerSchema,
  power: PowerNetworkSchema,
  culture: CulturalSystemSchema,
  geography: SpatialGeographySchema,
  topology_note: z.string().optional(), // 整体结构说明
});
export type SocialTopology = z.infer<typeof SocialTopologySchema>;

// ---------------------------------------------------------------------------
// 5. Narrative Rhythm
// ---------------------------------------------------------------------------

export const ChapterRhythmSchema = z.object({
  chapter_marker: z.string(),
  emotional_arc: z.string(),          // 情绪弧（起点→中段→终点）
  density: z.enum(["sparse", "balanced", "dense"]).default("balanced"),
  breathing_points: z.array(z.string()).default([]), // 必须的留白位置
  intensity_level: z.number().int().min(1).max(5).default(3),
});
export type ChapterRhythm = z.infer<typeof ChapterRhythmSchema>;

export const NarrativeRhythmSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  volume_curve: z.string().optional(), // 整卷的情绪曲线描述
  chapter_rhythms: z.array(ChapterRhythmSchema).default([]),
  silence_policy: z.string().optional(), // 留白与省略的统一原则
});
export type NarrativeRhythm = z.infer<typeof NarrativeRhythmSchema>;

// ---------------------------------------------------------------------------
// 6. Historical Context
// ---------------------------------------------------------------------------

export const PolicyAnchorSchema = z.object({
  year: z.string(),
  event: z.string(),
  impact_on_lives: z.string(), // 这条政策对普通人具体的影响
});
export type PolicyAnchor = z.infer<typeof PolicyAnchorSchema>;

export const HistoricalContextSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  era_range: z.string(),          // e.g. "1995-2003"
  primary_setting: z.string(),    // e.g. "皖南某县城"
  social_mood: z.string().optional(), // 时代情绪
  policy_anchors: z.array(PolicyAnchorSchema).default([]),
  material_anchors: z.record(z.string()).default({}), // 物价、工资、票证等
  language_anchors: z.array(z.string()).default([]),  // 流行语、新词、旧词的代际差
  anachronism_guard: z.array(z.string()).default([]), // 必须避免的时代错误
});
export type HistoricalContext = z.infer<typeof HistoricalContextSchema>;

// ---------------------------------------------------------------------------
// File-name registry for storage layer
// ---------------------------------------------------------------------------

export const LITERARY_TRUTH_FILES = {
  thematic_framework: "thematic_framework.json",
  character_psychology: "character_psychology.json",
  symbolic_network: "symbolic_network.json",
  social_topology: "social_topology.json",
  narrative_rhythm: "narrative_rhythm.json",
  historical_context: "historical_context.json",
} as const;

export type LiteraryTruthFileKey = keyof typeof LITERARY_TRUTH_FILES;
