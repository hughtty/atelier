/**
 * BookSettings.tsx — single page where the author manages everything that
 * defines a book's identity (low-frequency / one-time setup work).
 *
 * Sections:
 *   - 基本信息 (basic info): title, genre, language, chapter targets, etc.
 *   - 创作圣经 (the 6 Atelier literary truth files):
 *       thematic / character / symbol / social / rhythm / historical
 *
 * Per the UX redesign, high-frequency chapter operations (write / audit /
 * revise) live in the writing workbench (chat-based), not here.
 *
 * API contract (server.ts):
 *   GET  /api/v1/books/:id                                → book metadata
 *   GET  /api/v1/books/:id/literary-truth                 → availability + counts
 *   GET  /api/v1/books/:id/literary-truth/:key            → full JSON
 *   PUT  /api/v1/books/:id/literary-truth/:key            → save (Zod-validated)
 */

import { fetchJson, useApi } from "../hooks/use-api";
import { useState, useEffect } from "react";
import type { Theme } from "../hooks/use-theme";
import { useColors } from "../hooks/use-colors";
import type { StoryBibleTab } from "../hooks/use-hash-route";
import { STORY_BIBLE_TABS } from "../hooks/use-hash-route";
import { Save, Pencil, X, FileWarning, BookOpenCheck, AlertCircle, Sparkles, Loader2, Trash2, AlertTriangle } from "lucide-react";

interface LiteraryTruthAvailability {
  readonly thematic_framework: boolean;
  readonly character_psychology: boolean;
  readonly symbolic_network: boolean;
  readonly social_topology: boolean;
  readonly narrative_rhythm: boolean;
  readonly historical_context: boolean;
}

interface LiteraryTruthSummary {
  readonly availability: LiteraryTruthAvailability;
  readonly missingFiles: ReadonlyArray<keyof LiteraryTruthAvailability>;
  readonly anyPresent: boolean;
  readonly counts: {
    readonly thematic_value_tensions: number;
    readonly thematic_variations: number;
    readonly characters_total: number;
    readonly characters_protagonists: number;
    readonly symbols_total: number;
    readonly social_locations: number;
    readonly rhythm_chapters: number;
    readonly historical_anchors: number;
  };
}

interface LiteraryTruthFileResp {
  readonly key: string;
  readonly exists: boolean;
  readonly data: unknown;
}

// Tab → underlying file key mapping
const TAB_TO_KEY: Record<StoryBibleTab, keyof LiteraryTruthAvailability> = {
  thematic: "thematic_framework",
  character: "character_psychology",
  symbol: "symbolic_network",
  social: "social_topology",
  rhythm: "narrative_rhythm",
  historical: "historical_context",
};

const TAB_META: Record<StoryBibleTab, { readonly label: string; readonly hint: string; readonly cliCmd: string }> = {
  thematic: { label: "主题", hint: "核心命题、价值张力、变奏路线、结局姿态、禁忌解", cliCmd: "atelier theme" },
  character: { label: "人物心理", hint: "心理来源、矛盾性、注意习惯、关系动力学", cliCmd: "atelier character" },
  symbol: { label: "意象网络", hint: "核心意象、色彩-空间-动作象征系统、状态机", cliCmd: "atelier symbol" },
  social: { label: "社会拓扑", hint: "经济、权力、文化、空间四子层", cliCmd: "atelier social" },
  rhythm: { label: "叙事节奏", hint: "卷情绪曲线、章节呼吸点、密度", cliCmd: "(manual edit)" },
  historical: { label: "历史语境", hint: "年代、政策锚点、物质锚点、时代错位防护", cliCmd: "atelier social" },
};

interface Nav {
  readonly toBook: (id: string) => void;
  readonly toDashboard: () => void;
  readonly toBookSettingsTab: (bookId: string, tab: StoryBibleTab) => void;
}

interface BookInfo {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly language?: string;
  readonly status?: string;
  readonly targetChapters?: number;
  readonly chapterWordCount?: number;
}

export function BookSettings({
  bookId,
  tab,
  nav,
  theme,
}: {
  readonly bookId: string;
  readonly tab?: StoryBibleTab;
  readonly nav: Nav;
  readonly theme: Theme;
}) {
  const c = useColors(theme);
  const activeTab: StoryBibleTab = tab ?? "thematic";

  const { data: bookInfo } = useApi<BookInfo>(`/books/${bookId}`);
  const { data: summary, refetch: refetchSummary } = useApi<LiteraryTruthSummary>(
    `/books/${bookId}/literary-truth`,
  );
  const fileKey = TAB_TO_KEY[activeTab];
  const { data: fileResp, refetch: refetchFile } = useApi<LiteraryTruthFileResp>(
    `/books/${bookId}/literary-truth/${fileKey}`,
  );

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  // Reset edit state when switching tabs
  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setRegenError(null);
  }, [activeTab]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const resp = await fetchJson<{ ok?: boolean; error?: string }>(
        `/books/${bookId}/literary-truth/${fileKey}/regenerate`,
        { method: "POST" },
      );
      if (resp.error) {
        setRegenError(resp.error);
      } else {
        refetchFile();
        refetchSummary();
      }
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenerating(false);
    }
  };

  // Rhythm has no auto-generation agent yet (manual edit only).
  const hasAgent = fileKey !== "narrative_rhythm";

  const startEdit = () => {
    setEditText(JSON.stringify(fileResp?.data ?? {}, null, 2));
    setEditing(true);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const value = JSON.parse(editText);
      const resp = await fetchJson<{ ok?: boolean; error?: string }>(
        `/books/${bookId}/literary-truth/${fileKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        },
      );
      if (resp.error) {
        setSaveError(resp.error);
      } else {
        setEditing(false);
        refetchFile();
        refetchSummary();
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={nav.toDashboard} className={c.link}>书目</button>
        <span className="text-border">/</span>
        <button onClick={() => nav.toBook(bookId)} className={c.link}>{bookInfo?.title ?? bookId}</button>
        <span className="text-border">/</span>
        <span className="text-foreground">书籍设置</span>
      </div>

      <div>
        <h1 className="font-serif text-3xl">书籍设置</h1>
        <p className="text-sm text-muted-foreground mt-1">
          基本信息 + 创作圣经 · 定义这本书 DNA 的地方。日常写作请到写作工作台
        </p>
      </div>

      {/* Section 1: 基本信息 */}
      <div className={`border ${c.cardStatic} rounded-lg p-5 space-y-3`}>
        <h2 className="font-serif text-lg">基本信息</h2>
        {bookInfo ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="书名" value={bookInfo.title} />
            <InfoRow label="ID" value={bookInfo.id} mono />
            <InfoRow label="体裁" value={bookInfo.genre} />
            <InfoRow label="语言" value={bookInfo.language ?? "zh"} />
            <InfoRow label="状态" value={bookInfo.status ?? "—"} />
            <InfoRow label="目标章节数" value={String(bookInfo.targetChapters ?? "—")} />
            <InfoRow label="章节字数（软目标）" value={String(bookInfo.chapterWordCount ?? "—")} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">加载中…</p>
        )}
      </div>

      {/* Section 2: 创作圣经 header */}
      <div className="flex items-baseline gap-3 pt-2">
        <BookOpenCheck className="text-primary" size={22} />
        <h2 className="font-serif text-2xl">创作圣经</h2>
        <span className="text-xs text-muted-foreground">
          这部作品的主题、人物、意象、社会与历史 — 写每一章时被 agent 自动读取
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {STORY_BIBLE_TABS.map((t) => {
          const key = TAB_TO_KEY[t];
          const present = summary?.availability?.[key] ?? false;
          const isActive = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => nav.toBookSettingsTab(bookId, t)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{TAB_META[t].label}</span>
              {present ? (
                <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">●</span>
              ) : (
                <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">○</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className={`border ${c.cardStatic} rounded-lg p-6 min-h-[400px]`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl">{TAB_META[activeTab].label}</h2>
            <p className="text-xs text-muted-foreground mt-1">{TAB_META[activeTab].hint}</p>
          </div>
          <div className="flex items-center gap-2">
            {!editing && hasAgent && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-primary/30 text-primary rounded hover:bg-primary/10 disabled:opacity-50"
                title={fileResp?.exists ? "重新跑 agent 生成（会保留并改进既有内容）" : "跑 agent 首次生成"}
              >
                {regenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {regenerating ? "生成中..." : fileResp?.exists ? "重新生成" : "用 agent 生成"}
              </button>
            )}
            {fileResp?.exists && !editing && (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted/30"
              >
                <Pencil size={12} /> 编辑 JSON
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted/30"
                >
                  <X size={12} /> 取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save size={12} /> {saving ? "保存中..." : "保存"}
                </button>
              </>
            )}
          </div>
        </div>

        {regenError && (
          <div className="mb-3 p-2 text-xs text-destructive bg-destructive/10 rounded border border-destructive/30">
            <AlertCircle className="inline mr-1" size={12} />
            生成失败：{regenError}
          </div>
        )}

        {editing ? (
          <div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-[60vh] p-3 font-mono text-xs border border-border rounded bg-background"
              spellCheck={false}
            />
            {saveError && (
              <div className="mt-2 p-2 text-xs text-destructive bg-destructive/10 rounded border border-destructive/30">
                <AlertCircle className="inline mr-1" size={12} />
                {saveError}
              </div>
            )}
          </div>
        ) : !fileResp?.exists ? (
          <EmptyState tab={activeTab} bookId={bookId} />
        ) : (
          <TabReadView tab={activeTab} data={fileResp.data} />
        )}
      </div>

      {/* Danger zone — book deletion */}
      <DangerZone bookId={bookId} bookTitle={bookInfo?.title ?? bookId} onDeleted={() => nav.toDashboard()} />
    </div>
  );
}

function EmptyState({ tab, bookId }: { readonly tab: StoryBibleTab; readonly bookId: string }) {
  const meta = TAB_META[tab];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileWarning size={32} className="text-muted-foreground mb-3" />
      <h3 className="text-lg mb-2">「{meta.label}」尚未生成</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{meta.hint}</p>
      <code className="px-3 py-1.5 bg-muted/40 rounded text-xs font-mono">
        {meta.cliCmd} {bookId}
      </code>
      <p className="text-xs text-muted-foreground mt-3 max-w-md">
        在项目根目录运行该命令，agent 会读取你的 brief.md 生成对应真相文件
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema-aware read views
// ---------------------------------------------------------------------------

function TabReadView({ tab, data }: { readonly tab: StoryBibleTab; readonly data: unknown }) {
  if (!data || typeof data !== "object") {
    return <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(data, null, 2)}</pre>;
  }
  switch (tab) {
    case "thematic": return <ThematicView data={data as ThematicData} />;
    case "character": return <CharacterView data={data as CharacterData} />;
    case "symbol": return <SymbolView data={data as SymbolData} />;
    case "social": return <SocialView data={data as SocialData} />;
    case "rhythm": return <RhythmView data={data as RhythmData} />;
    case "historical": return <HistoricalView data={data as HistoricalData} />;
  }
}

// --- thematic ---
interface ThematicData {
  core_proposition?: string;
  thematic_question?: string;
  value_tensions?: Array<{ pole_a: string; pole_b: string; description: string }>;
  thematic_variations?: Array<{ chapter_range: string; perspective: string; refraction: string }>;
  ending_posture?: string;
  forbidden_resolutions?: string[];
  notes?: string;
}
function ThematicView({ data }: { readonly data: ThematicData }) {
  return (
    <div className="space-y-5">
      <Section label="核心命题">
        <p className="font-serif text-base leading-relaxed">{data.core_proposition}</p>
      </Section>
      {data.thematic_question && (
        <Section label="驱动问题">
          <p className="text-sm leading-relaxed text-muted-foreground">{data.thematic_question}</p>
        </Section>
      )}
      {data.value_tensions && data.value_tensions.length > 0 && (
        <Section label={`价值张力 (${data.value_tensions.length})`}>
          <div className="space-y-3">
            {data.value_tensions.map((v, i) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <div className="text-sm font-medium">
                  <span>{v.pole_a}</span>
                  <span className="mx-2 text-muted-foreground">↔</span>
                  <span>{v.pole_b}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {data.thematic_variations && data.thematic_variations.length > 0 && (
        <Section label={`变奏路线 (${data.thematic_variations.length})`}>
          <div className="space-y-2">
            {data.thematic_variations.map((v, i) => (
              <div key={i} className="text-sm">
                <span className="font-mono text-xs px-1.5 py-0.5 bg-muted/40 rounded mr-2">章 {v.chapter_range}</span>
                <span className="text-muted-foreground">通过 {v.perspective}：</span>
                <span>{v.refraction}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {data.ending_posture && (
        <Section label="结局姿态">
          <p className="text-sm leading-relaxed italic">{data.ending_posture}</p>
        </Section>
      )}
      {data.forbidden_resolutions && data.forbidden_resolutions.length > 0 && (
        <Section label={`禁忌解 (${data.forbidden_resolutions.length})`}>
          <ul className="space-y-1 text-sm">
            {data.forbidden_resolutions.map((r, i) => (
              <li key={i} className="flex gap-2"><span className="text-destructive">✗</span><span>{r}</span></li>
            ))}
          </ul>
        </Section>
      )}
      {data.notes && (
        <Section label="备注">
          <p className="text-xs leading-relaxed text-muted-foreground">{data.notes}</p>
        </Section>
      )}
    </div>
  );
}

// --- character ---
interface CharacterCardData {
  id: string;
  name: string;
  tier: string;
  age_range?: string;
  social_position?: string;
  psychological_origin?: { formative_event?: string; family_pattern?: string; class_imprint?: string; unresolved?: string };
  contradiction: string;
  habit_of_attention: string;
  arc_beats?: Array<{ chapter_marker: string; inner_state: string; visible_change: string }>;
  relations?: Array<{ with_character: string; baseline: string; current_pressure: string; unsayable?: string }>;
  voice_profile?: string;
  notes?: string;
}
interface CharacterData {
  characters?: CharacterCardData[];
  ensemble_balance_note?: string;
}
function CharacterView({ data }: { readonly data: CharacterData }) {
  const characters = data.characters ?? [];
  return (
    <div className="space-y-5">
      <div className="text-sm text-muted-foreground">
        共 <span className="font-medium text-foreground">{characters.length}</span> 个人物
        {data.ensemble_balance_note && (
          <span className="ml-3">· 群像平衡：{data.ensemble_balance_note}</span>
        )}
      </div>
      <div className="space-y-4">
        {characters.map((ch) => (
          <CharacterCard key={ch.id} ch={ch} />
        ))}
      </div>
    </div>
  );
}
function CharacterCard({ ch }: { readonly ch: CharacterCardData }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-muted/10">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-serif text-lg">{ch.name}</h3>
        <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">{ch.tier}</span>
        {ch.age_range && <span className="text-xs text-muted-foreground">{ch.age_range}</span>}
        {ch.social_position && <span className="text-xs text-muted-foreground">· {ch.social_position}</span>}
      </div>
      <div className="space-y-2 text-sm">
        <Field label="矛盾性">{ch.contradiction}</Field>
        <Field label="注意习惯">{ch.habit_of_attention}</Field>
        {ch.psychological_origin?.formative_event && (
          <Field label="塑形事件">{ch.psychological_origin.formative_event}</Field>
        )}
        {ch.psychological_origin?.family_pattern && (
          <Field label="家族模式">{ch.psychological_origin.family_pattern}</Field>
        )}
        {ch.psychological_origin?.unresolved && (
          <Field label="未化解">{ch.psychological_origin.unresolved}</Field>
        )}
        {ch.arc_beats && ch.arc_beats.length > 0 && (
          <Field label={`弧光节拍 (${ch.arc_beats.length})`}>
            <div className="space-y-1 mt-1">
              {ch.arc_beats.map((b, i) => (
                <div key={i} className="text-xs">
                  <span className="font-mono px-1 py-0.5 bg-muted/40 rounded mr-2">章 {b.chapter_marker}</span>
                  <span>{b.inner_state} → {b.visible_change}</span>
                </div>
              ))}
            </div>
          </Field>
        )}
        {ch.relations && ch.relations.length > 0 && (
          <Field label={`关系动力学 (${ch.relations.length})`}>
            <div className="space-y-1 mt-1">
              {ch.relations.map((r, i) => (
                <div key={i} className="text-xs">
                  <span className="font-mono mr-2">→ {r.with_character}</span>
                  <span className="text-muted-foreground">基线：{r.baseline}；张力：{r.current_pressure}</span>
                  {r.unsayable && <span className="text-muted-foreground italic">；未说出：{r.unsayable}</span>}
                </div>
              ))}
            </div>
          </Field>
        )}
        {ch.voice_profile && <Field label="声音肖像">{ch.voice_profile}</Field>}
      </div>
    </div>
  );
}

// --- symbol ---
interface SymbolData {
  core_images?: Array<{
    id: string;
    image: string;
    domain: string;
    thematic_link: string;
    first_appearance?: string;
    current_state: string;
    trajectory?: string;
  }>;
  color_palette?: Record<string, string>;
  space_symbolism?: Record<string, string>;
  action_metaphors?: Record<string, string>;
  network_constraint?: string;
}
function SymbolView({ data }: { readonly data: SymbolData }) {
  const STATE_COLORS: Record<string, string> = {
    seeded: "bg-blue-500/10 text-blue-600",
    echoed: "bg-amber-500/10 text-amber-600",
    transformed: "bg-emerald-500/10 text-emerald-600",
    silent: "bg-muted/40 text-muted-foreground",
  };
  return (
    <div className="space-y-5">
      {data.core_images && data.core_images.length > 0 && (
        <Section label={`核心意象 (${data.core_images.length})`}>
          <div className="space-y-2">
            {data.core_images.map((img) => (
              <div key={img.id} className="flex items-start gap-3 p-2.5 border border-border/40 rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{img.image}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-muted/40 rounded text-muted-foreground">{img.domain}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_COLORS[img.current_state] ?? "bg-muted/40"}`}>{img.current_state}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{img.thematic_link}</p>
                  {img.trajectory && (
                    <p className="text-xs text-muted-foreground/70 italic mt-1">演变：{img.trajectory}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {data.color_palette && Object.keys(data.color_palette).length > 0 && (
        <Section label="色彩象征">
          <KvList map={data.color_palette} />
        </Section>
      )}
      {data.space_symbolism && Object.keys(data.space_symbolism).length > 0 && (
        <Section label="空间象征">
          <KvList map={data.space_symbolism} />
        </Section>
      )}
      {data.action_metaphors && Object.keys(data.action_metaphors).length > 0 && (
        <Section label="动作隐喻">
          <KvList map={data.action_metaphors} />
        </Section>
      )}
      {data.network_constraint && (
        <Section label="网络约束">
          <p className="text-sm text-muted-foreground italic">{data.network_constraint}</p>
        </Section>
      )}
    </div>
  );
}

// --- social ---
interface SocialData {
  economic?: { description: string; income_brackets?: string[]; cost_anchors?: Record<string, string>; scarcities?: string[] };
  power?: { formal_powers?: string[]; informal_powers?: string[]; pressure_paths?: string[] };
  culture?: { values?: string[]; rituals?: string[]; generational_gaps?: string; language_layers?: string[] };
  geography?: { primary_locations?: string[]; spatial_pressure?: string; movement_patterns?: string[] };
  topology_note?: string;
}
function SocialView({ data }: { readonly data: SocialData }) {
  return (
    <div className="space-y-5">
      {data.economic && (
        <Section label="经济层">
          <p className="text-sm leading-relaxed mb-2">{data.economic.description}</p>
          {data.economic.scarcities && data.economic.scarcities.length > 0 && (
            <div className="text-xs mb-1"><span className="text-muted-foreground">匮乏：</span>{data.economic.scarcities.join("、")}</div>
          )}
          {data.economic.income_brackets && data.economic.income_brackets.length > 0 && (
            <div className="text-xs"><span className="text-muted-foreground">收入分层：</span>{data.economic.income_brackets.join("；")}</div>
          )}
          {data.economic.cost_anchors && Object.keys(data.economic.cost_anchors).length > 0 && (
            <div className="text-xs mt-1"><span className="text-muted-foreground">物价锚点：</span>
              {Object.entries(data.economic.cost_anchors).map(([k, v]) => `${k} = ${v}`).join("；")}
            </div>
          )}
        </Section>
      )}
      {data.power && (
        <Section label="权力网络">
          {data.power.formal_powers && data.power.formal_powers.length > 0 && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">正式权力：</span>{data.power.formal_powers.join("、")}</div>
          )}
          {data.power.informal_powers && data.power.informal_powers.length > 0 && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">非正式权力：</span>{data.power.informal_powers.join("、")}</div>
          )}
          {data.power.pressure_paths && data.power.pressure_paths.length > 0 && (
            <div className="text-sm"><span className="text-muted-foreground">压力传导：</span>{data.power.pressure_paths.join("；")}</div>
          )}
        </Section>
      )}
      {data.culture && (
        <Section label="文化系统">
          {data.culture.values && data.culture.values.length > 0 && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">核心价值：</span>{data.culture.values.join("、")}</div>
          )}
          {data.culture.rituals && data.culture.rituals.length > 0 && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">仪式：</span>{data.culture.rituals.join("、")}</div>
          )}
          {data.culture.generational_gaps && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">代际差异：</span>{data.culture.generational_gaps}</div>
          )}
          {data.culture.language_layers && data.culture.language_layers.length > 0 && (
            <div className="text-sm"><span className="text-muted-foreground">语言层次：</span>{data.culture.language_layers.join("、")}</div>
          )}
        </Section>
      )}
      {data.geography && (
        <Section label="空间地理">
          {data.geography.primary_locations && data.geography.primary_locations.length > 0 && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">主要场所：</span>{data.geography.primary_locations.join("、")}</div>
          )}
          {data.geography.spatial_pressure && (
            <div className="text-sm mb-1"><span className="text-muted-foreground">空间压力：</span>{data.geography.spatial_pressure}</div>
          )}
          {data.geography.movement_patterns && data.geography.movement_patterns.length > 0 && (
            <div className="text-sm"><span className="text-muted-foreground">移动模式：</span>{data.geography.movement_patterns.join("、")}</div>
          )}
        </Section>
      )}
      {data.topology_note && (
        <Section label="拓扑说明">
          <p className="text-xs text-muted-foreground italic">{data.topology_note}</p>
        </Section>
      )}
    </div>
  );
}

// --- rhythm ---
interface RhythmData {
  volume_curve?: string;
  silence_policy?: string;
  chapter_rhythms?: Array<{
    chapter_marker: string;
    emotional_arc: string;
    density: string;
    breathing_points?: string[];
    intensity_level: number;
  }>;
}
function RhythmView({ data }: { readonly data: RhythmData }) {
  return (
    <div className="space-y-5">
      {data.volume_curve && (
        <Section label="卷情绪曲线">
          <p className="text-sm leading-relaxed">{data.volume_curve}</p>
        </Section>
      )}
      {data.silence_policy && (
        <Section label="留白原则">
          <p className="text-sm leading-relaxed italic">{data.silence_policy}</p>
        </Section>
      )}
      {data.chapter_rhythms && data.chapter_rhythms.length > 0 && (
        <Section label={`章节节奏 (${data.chapter_rhythms.length})`}>
          <div className="space-y-2">
            {data.chapter_rhythms.map((r, i) => (
              <div key={i} className="border border-border/40 rounded p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs px-1.5 py-0.5 bg-muted/40 rounded">章 {r.chapter_marker}</span>
                  <span className="text-xs text-muted-foreground">密度：{r.density}</span>
                  <span className="text-xs text-muted-foreground">强度：{"●".repeat(r.intensity_level) + "○".repeat(Math.max(0, 5 - r.intensity_level))}</span>
                </div>
                <p className="text-sm">{r.emotional_arc}</p>
                {r.breathing_points && r.breathing_points.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">换气：{r.breathing_points.join("；")}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// --- historical ---
interface HistoricalData {
  era_range?: string;
  primary_setting?: string;
  social_mood?: string;
  policy_anchors?: Array<{ year: string; event: string; impact_on_lives: string }>;
  material_anchors?: Record<string, string>;
  language_anchors?: string[];
  anachronism_guard?: string[];
}
function HistoricalView({ data }: { readonly data: HistoricalData }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-sm">
        {data.era_range && <div><span className="text-muted-foreground">年代：</span><span className="font-medium">{data.era_range}</span></div>}
        {data.primary_setting && <div><span className="text-muted-foreground">地点：</span><span className="font-medium">{data.primary_setting}</span></div>}
      </div>
      {data.social_mood && (
        <Section label="时代情绪">
          <p className="text-sm leading-relaxed">{data.social_mood}</p>
        </Section>
      )}
      {data.policy_anchors && data.policy_anchors.length > 0 && (
        <Section label={`政策锚点 (${data.policy_anchors.length})`}>
          <div className="space-y-2">
            {data.policy_anchors.map((p, i) => (
              <div key={i} className="text-sm">
                <span className="font-mono text-xs px-1.5 py-0.5 bg-muted/40 rounded mr-2">{p.year}</span>
                <span className="font-medium">{p.event}</span>
                <div className="text-xs text-muted-foreground mt-0.5 ml-12">{p.impact_on_lives}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {data.material_anchors && Object.keys(data.material_anchors).length > 0 && (
        <Section label="物质锚点">
          <KvList map={data.material_anchors} />
        </Section>
      )}
      {data.language_anchors && data.language_anchors.length > 0 && (
        <Section label="语言锚点">
          <div className="flex flex-wrap gap-1.5">
            {data.language_anchors.map((l, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-muted/40 rounded">{l}</span>
            ))}
          </div>
        </Section>
      )}
      {data.anachronism_guard && data.anachronism_guard.length > 0 && (
        <Section label="时代错位防护">
          <ul className="space-y-1 text-sm">
            {data.anachronism_guard.map((a, i) => (
              <li key={i} className="flex gap-2"><span className="text-destructive">✗</span><span>{a}</span></li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function Section({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">{label}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground mr-2">{label}：</span>
      <span>{children}</span>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground min-w-[8em]">{label}</span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
    </div>
  );
}

function KvList({ map }: { readonly map: Record<string, string> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
      {Object.entries(map).map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{k}</span>
          <span className="text-muted-foreground">→</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger zone — destructive book deletion
// ---------------------------------------------------------------------------

function DangerZone({
  bookId,
  bookTitle,
  onDeleted,
}: {
  readonly bookId: string;
  readonly bookTitle: string;
  readonly onDeleted: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = typedConfirm === bookId;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const resp = await fetchJson<{ ok?: boolean; error?: string }>(
        `/books/${encodeURIComponent(bookId)}`,
        { method: "DELETE" },
      );
      if (resp.error) {
        setError(resp.error);
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mt-8 pt-6 border-t border-destructive/20">
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-destructive mb-1">危险操作 · Danger Zone</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                删除这本书会**永久**移除所有章节、真相文件、快照、会话。此操作不可撤销。
                如果只是想暂停或归档，可以在「基本信息」里把状态改成 paused 或 dropped。
              </p>
              <button
                onClick={() => { setShowModal(true); setTypedConfirm(""); setError(null); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={12} />
                删除这本书…
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <DeleteModal
          bookId={bookId}
          bookTitle={bookTitle}
          typedConfirm={typedConfirm}
          setTypedConfirm={setTypedConfirm}
          canConfirm={canConfirm}
          deleting={deleting}
          error={error}
          onCancel={() => setShowModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

function DeleteModal({
  bookId,
  bookTitle,
  typedConfirm,
  setTypedConfirm,
  canConfirm,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  readonly bookId: string;
  readonly bookTitle: string;
  readonly typedConfirm: string;
  readonly setTypedConfirm: (s: string) => void;
  readonly canConfirm: boolean;
  readonly deleting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
         onClick={onCancel}>
      <div
        className="w-[480px] max-w-[92vw] rounded-xl border border-destructive/30 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-destructive" />
            <h3 className="text-base font-medium text-destructive">永久删除《{bookTitle}》</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            该操作会从磁盘移除 <code className="font-mono">books/{bookId}/</code> 下的所有内容：
            章节正文、6 个真相文件、状态快照、写作会话。**无法恢复**。
          </p>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="block text-xs text-muted-foreground mb-1.5">
              确认操作：键入书 id <code className="font-mono text-foreground">{bookId}</code>
            </span>
            <input
              autoFocus
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder={bookId}
              className="w-full px-3 py-2 rounded border border-border/50 bg-background font-mono text-sm outline-none focus:border-destructive/50"
            />
          </label>
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 flex items-center justify-end gap-2 border-t border-border/30 bg-muted/20 rounded-b-xl">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-3 py-1.5 text-xs rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 transition-colors"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {deleting ? "删除中..." : "永久删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
