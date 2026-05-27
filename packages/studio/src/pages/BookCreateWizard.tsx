/**
 * BookCreateWizard — 6-step guided creation flow.
 *
 * Replaces the single-form BookCreate page. Default path walks the author
 * through 题材→简报→主题→人物→意象/社会→完成, running an agent at each
 * creative-bible step. A "跳过向导" button after step 2 short-circuits to a
 * minimal book (foundation only; prep agents skipped) — the author can run
 * those later from BookSettings or via chat.
 *
 * Server contract:
 *   - POST /api/v1/books/create        (existing, runs Architect async)
 *   - GET  /api/v1/books/:id/create-status   (poll for completion)
 *   - POST /api/v1/books/:id/literary-truth/:key/regenerate
 *   - GET  /api/v1/books/:id/literary-truth/:key
 */

import { useEffect, useState, useCallback } from "react";
import { fetchJson, useApi, putApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpenCheck,
  PenLine,
  Users,
  Image as ImageIcon,
  Globe,
  MessageSquare,
  SkipForward,
  RotateCcw,
  ChevronDown,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

const LITERARY_GENRES: ReadonlyArray<{ id: string; label: string; hint: string }> = [
  { id: "social-realism",  label: "社会现实主义", hint: "个体与结构的张力；阶级、制度、代际的肉身" },
  { id: "family-epic",     label: "家族史诗",     hint: "三代以上的承继与变形；时间是主角" },
  { id: "psychological",   label: "心理小说",     hint: "意识与记忆的内部地形；创伤、解离、重建" },
  { id: "existential",     label: "存在主义",     hint: "意义不在场的处境；姿态而非情节" },
  { id: "ecological",      label: "生态文学",     hint: "人与非人世界的相互错认；缓慢丧失" },
  { id: "historical",      label: "历史小说",     hint: "普通人在大事件中的私人时间" },
  { id: "urban-migration", label: "城市迁徙",     hint: "迁徙中身体的认知重写；既不属于城也不属于乡" },
  { id: "rural-decline",   label: "乡土衰落",     hint: "共同体在现代化压力下的散落；记下不再被记得的东西" },
  { id: "other",           label: "通用文学",     hint: "跨题材或不确定时选这一项" },
];

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

interface WizardForm {
  title: string;
  genre: string;
  language: "zh" | "en";
  targetChapters: number;
  chapterWordCount: number;
  brief: string;
}

const DEFAULT_FORM: WizardForm = {
  title: "",
  genre: "social-realism",
  language: "zh",
  targetChapters: 30,
  chapterWordCount: 3500,
  brief: "",
};

interface CreateStatus { readonly status: string; readonly error?: string }

interface Nav {
  readonly toDashboard: () => void;
  readonly toBook: (id: string) => void;
  readonly toBookSettings: (id: string) => void;
  readonly toServices?: () => void;
}

// ---------------------------------------------------------------------------
// Draft persistence (UX 1) — wizard state survives reload / nav-away.
// ---------------------------------------------------------------------------

const DRAFT_KEY = "atelier:book-create-wizard:draft";

interface PersistedDraft {
  readonly step: StepId;
  readonly form: WizardForm;
  readonly bookId: string | null;
  readonly skipped: boolean;
  readonly savedAt: number;
}

function loadDraft(): PersistedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (typeof parsed?.step !== "number" || !parsed.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(d: PersistedDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // quota or disabled — silently ignore
  }
}

function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------

export function BookCreateWizard({ nav, theme }: { readonly nav: Nav; readonly theme: Theme; readonly t: TFunction }) {
  const c = useColors(theme);

  // Restore from localStorage on first mount.
  const initialDraft = typeof window !== "undefined" ? loadDraft() : null;

  const [step, setStep] = useState<StepId>(initialDraft?.step ?? 1);
  const [form, setForm] = useState<WizardForm>(initialDraft?.form ?? DEFAULT_FORM);
  const [bookId, setBookId] = useState<string | null>(initialDraft?.bookId ?? null);
  const [createPhase, setCreatePhase] = useState<"idle" | "creating" | "done" | "error">(
    initialDraft?.bookId ? "done" : "idle"
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(initialDraft?.skipped ?? false);
  const [draftRestored, setDraftRestored] = useState(initialDraft !== null);

  // Per-prep-step state
  const [themeState,     setThemeState]     = useState<PrepState>(initialPrep());
  const [charState,      setCharState]      = useState<PrepState>(initialPrep());
  const [symbolState,    setSymbolState]    = useState<PrepState>(initialPrep());

  // Auto-save draft on any state change. Debounced is fine.
  useEffect(() => {
    saveDraft({ step, form, bookId, skipped, savedAt: Date.now() });
  }, [step, form, bookId, skipped]);

  // Active service / model — and an inline switcher (UX).
  const { data: cfg, refetch: refetchCfg } = useApi<{
    service: string | null;
    defaultModel: string | null;
    services: ReadonlyArray<{ service: string; defaultModel?: string | null; model?: string | null }>;
  }>("/services/config");
  const { data: allServices } = useApi<{
    services: ReadonlyArray<{ service: string; label: string; connected: boolean }>;
  }>("/services");
  const activeService = cfg?.service ?? "(unset)";
  const activeModel = cfg?.defaultModel ?? "(unset)";
  const connectedServices = (allServices?.services ?? []).filter((s) => s.connected);

  const switchActiveService = async (serviceId: string) => {
    if (serviceId === cfg?.service) return;
    // Find the default model for that service if available.
    const target = cfg?.services.find((s) => s.service === serviceId);
    const newDefault = target?.defaultModel ?? target?.model ?? undefined;
    await putApi("/services/config", {
      service: serviceId,
      ...(newDefault ? { defaultModel: newDefault } : {}),
    });
    refetchCfg();
  };

  const discardDraft = () => {
    clearDraft();
    setStep(1);
    setForm(DEFAULT_FORM);
    setBookId(null);
    setSkipped(false);
    setCreatePhase("idle");
    setCreateError(null);
    setThemeState(initialPrep());
    setCharState(initialPrep());
    setSymbolState(initialPrep());
    setDraftRestored(false);
  };

  // ---------------------------------------------------------------------------
  // Step 1 → 2 → 3
  // ---------------------------------------------------------------------------

  // Conflict info — when /books/create returns 409 (book already exists).
  const [conflict, setConflict] = useState<{ bookId: string } | null>(null);

  const startCreation = useCallback(async (skipPrep: boolean, opts?: { force?: boolean }) => {
    setCreatePhase("creating");
    setCreateError(null);
    setConflict(null);
    setSkipped(skipPrep);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      genre: form.genre,
      language: form.language,
      platform: "other",
      chapterWordCount: form.chapterWordCount,
      targetChapters: form.targetChapters,
      blurb: form.brief.trim() || undefined,
    };
    if (opts?.force) payload.force = true;

    try {
      // Use raw fetch (not fetchJson) so we can see both 409 (with structured
      // body) and 200 (plain success), and decide accordingly.
      const resp = await fetch("/api/v1/books/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.status === 409) {
        const body = (await resp.json().catch(() => ({}))) as { bookId?: string; error?: string };
        console.warn("[wizard] /books/create 409", body);
        if (body.bookId) {
          setBookId(body.bookId);
          setConflict({ bookId: body.bookId });
          setCreatePhase("idle"); // banner takes over from here
          return;
        }
        setCreatePhase("error");
        setCreateError(body.error ?? "Book already exists");
        return;
      }

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("[wizard] /books/create failed", resp.status, txt);
        setCreatePhase("error");
        setCreateError(txt || `HTTP ${resp.status}`);
        return;
      }

      const data = (await resp.json()) as { bookId?: string; error?: string };
      if (data.error || !data.bookId) {
        setCreatePhase("error");
        setCreateError(data.error ?? "未知错误");
        return;
      }
      setBookId(data.bookId);
      console.log("[wizard] book creation started", data.bookId);

      // Poll for completion (Architect runs async server-side).
      const finalStatus = await pollUntilDone(data.bookId);
      console.log("[wizard] pollUntilDone →", finalStatus);
      if (finalStatus === "error") {
        setCreatePhase("error");
        setCreateError("书籍创建失败（架构师 agent 返回错误，请检查 LLM 配置 / 服务额度）");
        return;
      }
      setCreatePhase("done");
      setStep(skipPrep ? 6 : 3);
    } catch (e) {
      console.error("[wizard] startCreation exception", e);
      setCreatePhase("error");
      setCreateError(e instanceof Error ? e.message : String(e));
    }
  }, [form]);

  // Conflict resolution actions
  const useExistingBook = () => {
    if (!conflict) return;
    setBookId(conflict.bookId);
    setConflict(null);
    setCreatePhase("done");
    setStep(skipped ? 6 : 3);
  };
  const forceRecreate = async () => {
    const wasSkipped = skipped;
    setConflict(null);
    await startCreation(wasSkipped, { force: true });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <button onClick={nav.toDashboard} className={`${c.link} text-sm inline-flex items-center gap-1`}>
          <ChevronLeft size={14} /> 书目
        </button>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">新建一本严肃文学作品</h1>
          {/* Active service / model — inline switcher (no navigation jump) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border border-border/50 bg-card/30 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors outline-none focus:ring-2 focus:ring-primary/20"
              title="当前用于生成的模型 · 点击切换"
            >
              <Sparkles size={10} className="text-primary" />
              <span className="font-medium">{activeService}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="font-mono">{activeModel}</span>
              <ChevronDown size={10} className="opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[280px]">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                切换服务（已连接的服务）
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {connectedServices.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  还没有任何服务已连接。先去服务商管理配置 key。
                </div>
              )}
              {connectedServices.map((s) => {
                const isCurrent = s.service === cfg?.service;
                const model = cfg?.services.find((x) => x.service === s.service)?.defaultModel
                  ?? cfg?.services.find((x) => x.service === s.service)?.model
                  ?? null;
                return (
                  <DropdownMenuItem
                    key={s.service}
                    onClick={() => void switchActiveService(s.service)}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    {isCurrent ? <Check size={12} className="text-primary" /> : <span className="w-3" />}
                    <div className="flex-1 min-w-0">
                      <div className={isCurrent ? "text-primary font-medium" : ""}>{s.label}</div>
                      {model && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{model}</div>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav.toServices?.()} className="text-xs text-muted-foreground">
                管理所有服务 →
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">
          通过 6 步引导建立这本书的 DNA。每一步都可以编辑或重新生成；如果你想跳过引导，
          创建空书后再到「书籍设置」补足。
        </p>
      </header>

      {/* Draft-restored notice (UX 1) */}
      {draftRestored && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs">
          <span>已恢复上次未完成的草稿（第 {step} 步 · 《{form.title || "（未命名）"}》）。</span>
          <button
            onClick={discardDraft}
            className="ml-auto underline hover:text-amber-800 dark:hover:text-amber-200"
          >
            重新开始
          </button>
          <button
            onClick={() => setDraftRestored(false)}
            className="hover:text-amber-800 dark:hover:text-amber-200"
          >
            继续
          </button>
        </div>
      )}

      <StepperBar step={step} skipped={skipped} />

      {/* Step 1 — 基本信息 */}
      {step === 1 && (
        <StepCard
          title="第 1 步 · 基本信息"
          desc="书名和体裁；其余字段以后还能改。"
        >
          <div className="space-y-5">
            <Field label="书名">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="比如：河边"
                className="w-full px-3 py-2 rounded border border-border/50 bg-background outline-none focus:border-primary/50"
              />
            </Field>

            <Field label="体裁">
              <div className="grid sm:grid-cols-2 gap-2">
                {LITERARY_GENRES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setForm({ ...form, genre: g.id })}
                    className={`text-left p-3 rounded border transition-colors ${
                      form.genre === g.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border bg-card/30"
                    }`}
                  >
                    <div className={`text-sm font-medium ${form.genre === g.id ? "text-primary" : ""}`}>{g.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{g.hint}</div>
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="语言">
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value as "zh" | "en" })}
                  className="w-full px-3 py-2 rounded border border-border/50 bg-background outline-none"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="目标章节数">
                <input
                  type="number"
                  value={form.targetChapters}
                  onChange={(e) => setForm({ ...form, targetChapters: parseInt(e.target.value, 10) || 30 })}
                  className="w-full px-3 py-2 rounded border border-border/50 bg-background outline-none"
                />
              </Field>
              <Field label="单章字数（软目标）">
                <input
                  type="number"
                  value={form.chapterWordCount}
                  onChange={(e) => setForm({ ...form, chapterWordCount: parseInt(e.target.value, 10) || 3500 })}
                  className="w-full px-3 py-2 rounded border border-border/50 bg-background outline-none"
                />
              </Field>
            </div>
          </div>
          <Footer>
            <span />
            <button
              onClick={() => setStep(2)}
              disabled={!form.title.trim() || !form.genre}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              下一步：写创作简报
              <ChevronRight size={14} />
            </button>
          </Footer>
        </StepCard>
      )}

      {/* Step 2 — 创作简报 */}
      {step === 2 && (
        <StepCard
          title="第 2 步 · 创作简报"
          desc="500–2000 字描述这本书的故事核心。这是后续 agent 生成主题、人物、意象的输入源。"
        >
          <Field label={`brief.md（${form.brief.length} 字）`}>
            <textarea
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              placeholder={`# ${form.title || "书名"} — 创作简报\n\n## 故事核心\n…\n\n## 主要人物\n- …\n\n## 想要的主题\n…\n\n## 感觉\n…`}
              rows={18}
              className="w-full px-3 py-2 rounded border border-border/50 bg-background outline-none focus:border-primary/50 font-mono text-sm leading-relaxed"
            />
          </Field>
          {createPhase === "creating" && (
            <Notice tone="primary">
              <Loader2 size={14} className="animate-spin" />
              架构师正在生成基础（书目录 / 卷纲 / 角色矩阵），大约 30 秒 ~ 2 分钟…
            </Notice>
          )}
          {createPhase === "error" && (
            <Notice tone="error">
              <AlertCircle size={14} />
              <span>创建失败：{createError}</span>
              <button onClick={() => setCreatePhase("idle")} className="ml-auto text-xs underline">重试</button>
            </Notice>
          )}
          {/* Conflict recovery — book already exists on disk */}
          {conflict && (
            <div className="my-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertCircle size={14} />
                <span className="font-medium">
                  这本书已经存在了：<span className="font-mono">{conflict.bookId}</span>
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                可能是上次创建成功了但 UI 没收到完成信号。你可以：
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={useExistingBook}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <CheckCircle2 size={12} />
                  继续使用这本书
                </button>
                <button
                  onClick={() => void forceRecreate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <RotateCcw size={12} />
                  删除并重新建构
                </button>
                <button
                  onClick={() => setConflict(null)}
                  className="ml-auto text-muted-foreground hover:text-foreground underline text-[11px]"
                >
                  忽略
                </button>
              </div>
            </div>
          )}
          <Footer>
            <button onClick={() => setStep(1)} className="secondary-btn">
              <ChevronLeft size={14} />
              上一步
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void startCreation(true)}
                disabled={createPhase === "creating" || !form.brief.trim()}
                className="ghost-btn"
                title="跳过引导，仅创建基础书架。可稍后到书籍设置补主题/人物/意象/社会"
              >
                <SkipForward size={14} />
                跳过引导，直接创建
              </button>
              <button
                onClick={() => void startCreation(false)}
                disabled={createPhase === "creating" || !form.brief.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Sparkles size={14} />
                开始建构 → 主题
              </button>
            </div>
          </Footer>
        </StepCard>
      )}

      {/* Step 3 — 主题 */}
      {step === 3 && bookId && (
        <PrepStep
          stepNum={3}
          title="主题骨架"
          icon={<Sparkles size={16} />}
          truthKey="thematic_framework"
          bookId={bookId}
          state={themeState}
          setState={setThemeState}
          summary={themeSummary}
          onPrev={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {/* Step 4 — 人物心理 */}
      {step === 4 && bookId && (
        <PrepStep
          stepNum={4}
          title="人物心理"
          icon={<Users size={16} />}
          truthKey="character_psychology"
          bookId={bookId}
          state={charState}
          setState={setCharState}
          summary={characterSummary}
          onPrev={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}

      {/* Step 5 — 意象网络 + 社会拓扑 */}
      {step === 5 && bookId && (
        <SymbolSocialStep
          bookId={bookId}
          state={symbolState}
          setState={setSymbolState}
          onPrev={() => setStep(4)}
          onNext={() => setStep(6)}
        />
      )}

      {/* Step 6 — 完成 */}
      {step === 6 && bookId && (
        <FinishStep
          bookId={bookId}
          title={form.title}
          skipped={skipped}
          onGoChat={() => { clearDraft(); nav.toBook(bookId); }}
          onGoSettings={() => { clearDraft(); nav.toBookSettings(bookId); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PrepStep — generic agent-run step (theme / character)
// ---------------------------------------------------------------------------

interface PrepState {
  phase: "idle" | "running" | "done" | "error";
  error: string | null;
}
function initialPrep(): PrepState { return { phase: "idle", error: null }; }

function PrepStep({
  stepNum,
  title,
  icon,
  truthKey,
  bookId,
  state,
  setState,
  summary,
  onPrev,
  onNext,
}: {
  readonly stepNum: number;
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly truthKey: "thematic_framework" | "character_psychology" | "symbolic_network" | "social_topology" | "historical_context";
  readonly bookId: string;
  readonly state: PrepState;
  readonly setState: (s: PrepState) => void;
  readonly summary: (data: unknown) => React.ReactNode;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}) {
  const { data: file, refetch } = useApi<{ exists: boolean; data: unknown }>(
    `/books/${bookId}/literary-truth/${truthKey}`,
  );
  const exists = file?.exists ?? false;

  // Auto-run on first entry if no file yet and idle.
  useEffect(() => {
    if (!exists && state.phase === "idle") {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exists]);

  const run = async () => {
    setState({ phase: "running", error: null });
    try {
      const r = await fetchJson<{ ok?: boolean; error?: string }>(
        `/books/${bookId}/literary-truth/${truthKey}/regenerate`,
        { method: "POST" },
      );
      if (r.error) {
        setState({ phase: "error", error: r.error });
      } else {
        setState({ phase: "done", error: null });
        refetch();
      }
    } catch (e) {
      setState({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <StepCard title={`第 ${stepNum} 步 · ${title}`} desc="">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm text-muted-foreground">基于你的 brief 自动生成。生成后你可以审阅、重新生成、或在设置里精修。</span>
      </div>

      {state.phase === "running" && (
        <Notice tone="primary">
          <Loader2 size={14} className="animate-spin" />
          Agent 正在生成…（约 30 秒 – 2 分钟，取决于模型与简报长度）
        </Notice>
      )}
      {state.phase === "error" && (
        <Notice tone="error">
          <AlertCircle size={14} />
          <span>生成失败：{state.error}</span>
          <button onClick={() => void run()} className="ml-auto text-xs underline">重试</button>
        </Notice>
      )}
      {exists && file?.data !== undefined && file.data !== null && (
        <div className="rounded-lg border border-border/40 bg-card/30 p-4">
          {summary(file.data)}
        </div>
      )}

      <Footer>
        <button onClick={onPrev} className="secondary-btn">
          <ChevronLeft size={14} /> 上一步
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void run()}
            disabled={state.phase === "running"}
            className="secondary-btn"
          >
            <RotateCcw size={14} />
            重新生成
          </button>
          <button
            onClick={onNext}
            disabled={!exists || state.phase === "running"}
            className="primary-btn"
          >
            接受并继续
            <ChevronRight size={14} />
          </button>
        </div>
      </Footer>
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// SymbolSocialStep — runs symbol + social in parallel (single agent writes both)
// ---------------------------------------------------------------------------

function SymbolSocialStep({
  bookId,
  state,
  setState,
  onPrev,
  onNext,
}: {
  readonly bookId: string;
  readonly state: PrepState;
  readonly setState: (s: PrepState) => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}) {
  const { data: sym, refetch: refSym } = useApi<{ exists: boolean; data: unknown }>(
    `/books/${bookId}/literary-truth/symbolic_network`,
  );
  const { data: soc, refetch: refSoc } = useApi<{ exists: boolean; data: unknown }>(
    `/books/${bookId}/literary-truth/social_topology`,
  );
  const symExists = sym?.exists ?? false;
  const socExists = soc?.exists ?? false;
  const bothExist = symExists && socExists;

  useEffect(() => {
    if (!bothExist && state.phase === "idle") {
      void runBoth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothExist]);

  const runBoth = async () => {
    setState({ phase: "running", error: null });
    try {
      // Run sequentially to avoid hammering the same API quota at once.
      const symResp = await fetchJson<{ ok?: boolean; error?: string }>(
        `/books/${bookId}/literary-truth/symbolic_network/regenerate`,
        { method: "POST" },
      );
      if (symResp.error) throw new Error(symResp.error);
      const socResp = await fetchJson<{ ok?: boolean; error?: string }>(
        `/books/${bookId}/literary-truth/social_topology/regenerate`,
        { method: "POST" },
      );
      if (socResp.error) throw new Error(socResp.error);
      setState({ phase: "done", error: null });
      refSym();
      refSoc();
    } catch (e) {
      setState({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <StepCard title="第 5 步 · 意象网络 + 社会拓扑" desc="">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon size={16} /><Globe size={16} />
        <span className="text-sm text-muted-foreground">意象与社会拓扑同时生成；后者会同时写入「历史语境」真相文件。</span>
      </div>

      {state.phase === "running" && (
        <Notice tone="primary">
          <Loader2 size={14} className="animate-spin" />
          Agent 正在生成意象网络 & 社会拓扑…
        </Notice>
      )}
      {state.phase === "error" && (
        <Notice tone="error">
          <AlertCircle size={14} />
          <span>生成失败：{state.error}</span>
          <button onClick={() => void runBoth()} className="ml-auto text-xs underline">重试</button>
        </Notice>
      )}
      {bothExist && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/40 bg-card/30 p-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">意象网络</h4>
            {symbolSummary(sym!.data)}
          </div>
          <div className="rounded-lg border border-border/40 bg-card/30 p-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">社会拓扑</h4>
            {socialSummary(soc!.data)}
          </div>
        </div>
      )}

      <Footer>
        <button onClick={onPrev} className="secondary-btn">
          <ChevronLeft size={14} /> 上一步
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => void runBoth()} disabled={state.phase === "running"} className="secondary-btn">
            <RotateCcw size={14} />
            重新生成
          </button>
          <button onClick={onNext} disabled={!bothExist || state.phase === "running"} className="primary-btn">
            接受并完成
            <ChevronRight size={14} />
          </button>
        </div>
      </Footer>
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// FinishStep
// ---------------------------------------------------------------------------

function FinishStep({
  bookId,
  title,
  skipped,
  onGoChat,
  onGoSettings,
}: {
  readonly bookId: string;
  readonly title: string;
  readonly skipped: boolean;
  readonly onGoChat: () => void;
  readonly onGoSettings: () => void;
}) {
  return (
    <StepCard title="第 6 步 · 完成" desc="">
      <div className="text-center py-6 space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="font-serif text-xl">《{title}》已创建</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {skipped
            ? "你跳过了创作圣经引导。可以随时到「书籍设置」用 agent 补足主题/人物/意象/社会；或者先到写作工作台开始写第一章。"
            : "创作圣经已就绪 — agent 会在写每一章时自动注入主题、人物、意象、社会与历史的约束。"}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground/60">book id: {bookId}</p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <button onClick={onGoSettings} className="secondary-btn">
            <BookOpenCheck size={14} />
            查看 / 调整圣经
          </button>
          <button onClick={onGoChat} className="primary-btn">
            <MessageSquare size={14} />
            进入写作工作台
          </button>
        </div>
      </div>
    </StepCard>
  );
}

// ---------------------------------------------------------------------------
// Stepper bar / helpers / styling primitives
// ---------------------------------------------------------------------------

function StepperBar({ step, skipped }: { readonly step: StepId; readonly skipped: boolean }) {
  const labels: Array<{ id: StepId; label: string; icon: React.ReactNode }> = [
    { id: 1, label: "基本信息", icon: <PenLine size={12} /> },
    { id: 2, label: "创作简报", icon: <PenLine size={12} /> },
    { id: 3, label: "主题",     icon: <Sparkles size={12} /> },
    { id: 4, label: "人物",     icon: <Users size={12} /> },
    { id: 5, label: "意象/社会", icon: <ImageIcon size={12} /> },
    { id: 6, label: "完成",     icon: <CheckCircle2 size={12} /> },
  ];
  return (
    <div className="flex items-center gap-1">
      {labels.map((l, i) => {
        const done = l.id < step;
        const active = l.id === step;
        const dim = skipped && l.id >= 3 && l.id <= 5;
        return (
          <div key={l.id} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
              active
                ? "bg-primary/10 text-primary border border-primary/30"
                : done
                  ? "text-muted-foreground"
                  : dim
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground/60"
            }`}>
              {l.icon}
              <span>{l.id}. {l.label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-px ${l.id < step ? "bg-primary/30" : "bg-border/40"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ title, desc, children }: { readonly title: string; readonly desc: string; readonly children: React.ReactNode }) {
  return (
    <div className="border border-border/50 rounded-2xl bg-card/30 p-6">
      <header className="mb-5">
        <h2 className="font-serif text-xl">{title}</h2>
        {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
      </header>
      {children}
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Footer({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30 gap-3 flex-wrap">
      {children}
    </div>
  );
}

function Notice({ tone, children }: { readonly tone: "primary" | "error"; readonly children: React.ReactNode }) {
  const cls = tone === "primary"
    ? "bg-primary/5 border-primary/20 text-primary"
    : "bg-destructive/5 border-destructive/30 text-destructive";
  return (
    <div className={`my-3 flex items-center gap-2 px-3 py-2 rounded border text-xs ${cls}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-truth-file summary renderers (very compact — full views live in BookSettings)
// ---------------------------------------------------------------------------

function themeSummary(data: unknown): React.ReactNode {
  const d = data as { core_proposition?: string; value_tensions?: Array<{ pole_a: string; pole_b: string }>; ending_posture?: string };
  return (
    <div className="space-y-2 text-sm">
      {d.core_proposition && <p className="leading-relaxed">{d.core_proposition}</p>}
      {d.value_tensions && d.value_tensions.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {d.value_tensions.slice(0, 3).map((v, i) => (
            <div key={i}>{v.pole_a} ↔ {v.pole_b}</div>
          ))}
        </div>
      )}
      {d.ending_posture && <p className="text-xs text-muted-foreground italic">结局姿态：{d.ending_posture}</p>}
    </div>
  );
}

function characterSummary(data: unknown): React.ReactNode {
  const d = data as { characters?: Array<{ name: string; tier: string; contradiction: string }> };
  const chars = d.characters ?? [];
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">{chars.length} 个人物：</p>
      <div className="space-y-1.5">
        {chars.slice(0, 6).map((ch, i) => (
          <div key={i}>
            <span className="font-medium">{ch.name}</span>
            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-muted/40 rounded text-muted-foreground">{ch.tier}</span>
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{ch.contradiction}</p>
          </div>
        ))}
        {chars.length > 6 && <div className="text-xs text-muted-foreground/70">… 还有 {chars.length - 6} 个</div>}
      </div>
    </div>
  );
}

function symbolSummary(data: unknown): React.ReactNode {
  const d = data as { core_images?: Array<{ image: string; domain: string; current_state: string }> };
  const imgs = d.core_images ?? [];
  return (
    <div className="space-y-1 text-xs">
      <p className="text-muted-foreground">{imgs.length} 个意象：</p>
      <div className="flex flex-wrap gap-1 mt-1">
        {imgs.slice(0, 12).map((img, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px]">{img.image}</span>
        ))}
      </div>
    </div>
  );
}

function socialSummary(data: unknown): React.ReactNode {
  const d = data as { economic?: { description?: string }; geography?: { primary_locations?: string[] } };
  return (
    <div className="space-y-1.5 text-xs">
      {d.economic?.description && <p className="leading-relaxed">{d.economic.description}</p>}
      {d.geography?.primary_locations && d.geography.primary_locations.length > 0 && (
        <p className="text-muted-foreground">场所：{d.geography.primary_locations.join(" · ")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Polling util
// ---------------------------------------------------------------------------

async function pollUntilDone(bookId: string): Promise<"ok" | "error"> {
  const startedAt = Date.now();
  const maxMs = 5 * 60 * 1000; // 5 min cap
  // Track whether we've ever seen a "creating" status. Once we have, a later
  // "missing" / 404 means the server cleared the entry on success.
  let sawCreating = false;
  while (Date.now() - startedAt < maxMs) {
    try {
      const resp = await fetch(
        `/api/v1/books/${encodeURIComponent(bookId)}/create-status`,
      );
      if (resp.status === 404) {
        // Server's pre-fix shape: 404 with "missing". After the fix the
        // server returns 200 {status:"ready"} when book.json exists. Either
        // way, if we previously saw "creating", this transition means done.
        if (sawCreating) return "ok";
      } else if (resp.ok) {
        const data = (await resp.json()) as CreateStatus;
        if (data.status === "ready" || data.status === "done") return "ok";
        if (data.status === "error") return "error";
        if (data.status === "creating") sawCreating = true;
      }
    } catch {
      // brief network blip — keep polling
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return "error";
}
