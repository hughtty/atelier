/**
 * ChapterList — read-only preview of all chapters in a book.
 *
 * Replaces the old BookDetail page (which mixed chapter browsing with audit
 * dropdowns, revise modes, export controls and inline book settings — all of
 * which now belong elsewhere):
 *
 *   - audit / revise per chapter   → inside chat (AuditPanel + tool cards)
 *   - book settings (basic info)   → BookSettings page
 *   - export                       → BookSettings (one-time per release)
 *
 * What stays here:
 *   - A clean scrollable list: 章号 + 标题 + 状态 + 字数 + 第一段预览
 *   - Per-row action: 「阅读」 → ChapterReader (immersive reading)
 *   - Per-row action: 「在对话中讨论 →」 → ChatPage with prefilled input
 *   - One bulk action: 「通过全部待审 (N)」 (only when reviewable chapters exist)
 *
 * The intent: this page is for *browsing finished work*. Modification work
 * happens via the chat conversation.
 */

import { fetchJson, useApi, postApi } from "../hooks/use-api";
import { useEffect, useMemo, useState } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import { useColors } from "../hooks/use-colors";
import { useChatStore } from "../store/chat";
import { shouldRefetchBookView } from "../hooks/use-book-activity";
import {
  Eye,
  Check,
  RotateCcw,
  CheckCheck,
  MessageSquare,
  ScrollText,
  FileText,
  Hash,
  Type,
  Download,
  Loader2,
} from "lucide-react";

interface ChapterMeta {
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly wordCount: number;
  readonly preview?: string;
}

interface BookData {
  readonly book: {
    readonly id: string;
    readonly title: string;
    readonly genre: string;
    readonly status: string;
    readonly chapterWordCount: number;
    readonly targetChapters?: number;
    readonly language?: string;
  };
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly nextChapter: number;
}

const STATUS_LABEL: Record<string, { readonly label: string; readonly color: string }> = {
  "approved":         { label: "已通过",   color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  "ready-for-review": { label: "待审阅",   color: "bg-amber-500/10  text-amber-600  border-amber-500/30" },
  "drafted":          { label: "草稿",     color: "bg-muted/40      text-muted-foreground border-border/40" },
  "needs-revision":   { label: "需修订",   color: "bg-destructive/10 text-destructive border-destructive/30" },
  "imported":         { label: "已导入",   color: "bg-blue-500/10   text-blue-600    border-blue-500/30" },
  "audit-failed":     { label: "审计失败", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Nav {
  readonly toDashboard: () => void;
  readonly toBook: (id: string) => void;              // chat
  readonly toChapter: (bookId: string, num: number) => void;
  readonly toBookSettings: (id: string) => void;
}

export function ChapterList({
  bookId,
  nav,
  theme,
  t,
  sse,
}: {
  readonly bookId: string;
  readonly nav: Nav;
  readonly theme: Theme;
  readonly t: TFunction;
  readonly sse: { messages: ReadonlyArray<SSEMessage> };
}) {
  const c = useColors(theme);
  const { data, loading, error, refetch } = useApi<BookData>(`/books/${bookId}`);

  // Refresh when SSE signals a book-affecting event.
  useEffect(() => {
    if (sse.messages.length === 0) return;
    const latest = sse.messages[sse.messages.length - 1];
    if (latest && shouldRefetchBookView(latest, bookId)) {
      refetch();
    }
  }, [sse.messages, bookId, refetch]);

  const reviewableCount = useMemo(
    () => (data?.chapters ?? []).filter((c) => c.status === "ready-for-review").length,
    [data?.chapters],
  );

  const [approvingAll, setApprovingAll] = useState(false);

  const handleApproveAll = async () => {
    if (!data) return;
    if (!window.confirm(`通过全部 ${reviewableCount} 个待审章节？`)) return;
    setApprovingAll(true);
    try {
      for (const chapter of data.chapters) {
        if (chapter.status === "ready-for-review") {
          await postApi(`/books/${bookId}/chapters/${chapter.number}/approve`);
        }
      }
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve-all failed");
    } finally {
      setApprovingAll(false);
    }
  };

  // ── Action: jump back to chat focused on this chapter ──
  const discussInChat = (chapter: ChapterMeta) => {
    // Prefill the chat input; user reviews and sends. This gives an
    // explicit hand-off rather than silently auto-sending.
    useChatStore.getState().setInput(
      `请帮我聚焦到「第 ${chapter.number} 章 · ${chapter.title}」。先读全文，然后我们一起讨论需要修改的地方。`,
    );
    nav.toBook(bookId);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={16} /> 加载中…</div>;
  }
  if (error || !data) {
    return <div className="p-6 text-destructive bg-destructive/5 rounded-lg border border-destructive/20">{String(error ?? "无法加载书籍")}</div>;
  }

  const chapters = [...data.chapters].sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={nav.toDashboard} className={c.link}>书目</button>
        <span className="text-border">/</span>
        <button onClick={() => nav.toBook(bookId)} className={c.link}>{data.book.title}</button>
        <span className="text-border">/</span>
        <span className="text-foreground">章节</span>
      </div>

      {/* Title + summary */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl">章节</h1>
          <p className="text-sm text-muted-foreground mt-1">
            阅览本书已写章节。要修改某一章，点「在对话中讨论」回到对话流。
          </p>
        </div>
        <button
          onClick={() => nav.toBook(bookId)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          title="进入写作工作台（对话流）"
        >
          <MessageSquare size={14} />
          进入写作工作台
        </button>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg border border-border/40 bg-card/30 text-xs text-muted-foreground">
        <Stat label="共" value={`${chapters.length} 章`} />
        <Stat label="已通过" value={String(chapters.filter((c) => c.status === "approved").length)} />
        <Stat label="待审" value={String(reviewableCount)} accent={reviewableCount > 0 ? "amber" : undefined} />
        <Stat label="需修订" value={String(chapters.filter((c) => c.status === "needs-revision").length)} accent="destructive" />
        <Stat label="总字数" value={chapters.reduce((s, c) => s + (c.wordCount ?? 0), 0).toLocaleString()} />
        <div className="flex-1" />
        {reviewableCount > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 rounded hover:bg-emerald-500/20 disabled:opacity-50 transition-colors border border-emerald-500/20"
          >
            {approvingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            通过全部待审 ({reviewableCount})
          </button>
        )}
      </div>

      {/* Chapter rows */}
      {chapters.length === 0 ? (
        <EmptyState onGoChat={() => nav.toBook(bookId)} />
      ) : (
        <ul className="space-y-2">
          {chapters.map((ch) => (
            <ChapterRow
              key={ch.number}
              bookId={bookId}
              chapter={ch}
              onRead={() => nav.toChapter(bookId, ch.number)}
              onDiscuss={() => discussInChat(ch)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { readonly label: string; readonly value: string; readonly accent?: "amber" | "destructive" }) {
  const accentClass = accent === "amber"
    ? "text-amber-600"
    : accent === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <span className="flex items-baseline gap-1.5">
      <span>{label}</span>
      <span className={`text-sm font-medium ${accentClass}`}>{value}</span>
    </span>
  );
}

function ChapterRow({
  bookId,
  chapter,
  onRead,
  onDiscuss,
}: {
  readonly bookId: string;
  readonly chapter: ChapterMeta;
  readonly onRead: () => void;
  readonly onDiscuss: () => void;
}) {
  const status = STATUS_LABEL[chapter.status] ?? { label: chapter.status, color: "bg-muted/40 text-muted-foreground border-border/40" };

  // Load first-paragraph preview lazily (only when row is first rendered).
  // For now, use server-provided preview if available; otherwise fetch on demand.
  const [preview, setPreview] = useState<string | undefined>(chapter.preview);
  useEffect(() => {
    if (preview !== undefined) return;
    let cancelled = false;
    fetchJson<{ content?: string }>(`/books/${bookId}/chapters/${chapter.number}`)
      .then((r) => {
        if (cancelled) return;
        const text = (r.content ?? "")
          .replace(/^#[^\n]*\n+/, "")             // strip leading title
          .replace(/^\s+/, "")
          .split(/\n\n/)[0]                       // first paragraph
          .slice(0, 240);
        setPreview(text);
      })
      .catch(() => setPreview(""));
    return () => { cancelled = true; };
  }, [bookId, chapter.number, preview]);

  return (
    <li className="rounded-lg border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
      <div className="p-4 flex gap-4">
        {/* Left: chapter number */}
        <div className="shrink-0 text-center pt-1">
          <div className="font-serif text-2xl text-muted-foreground/70 leading-none">{String(chapter.number).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-1">章</div>
        </div>

        {/* Middle: title + preview + meta */}
        <div className="flex-1 min-w-0">
          <button
            onClick={onRead}
            className="text-left w-full group"
          >
            <h3 className="font-serif text-lg font-medium leading-tight group-hover:text-primary transition-colors">
              {chapter.title}
            </h3>
          </button>
          {preview && (
            <p className="text-sm text-muted-foreground/80 leading-relaxed mt-1.5 line-clamp-2">
              {preview}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${status.color}`}>
              {chapter.status === "approved" && <Check size={10} />}
              {chapter.status === "ready-for-review" && <Eye size={10} />}
              {chapter.status === "drafted" && <FileText size={10} />}
              {chapter.status === "needs-revision" && <RotateCcw size={10} />}
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <Type size={10} />
              {chapter.wordCount?.toLocaleString() ?? 0} 字
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash size={10} />
              {chapter.number}
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="shrink-0 flex flex-col gap-1.5">
          <button
            onClick={onRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            title="沉浸式阅读"
          >
            <ScrollText size={12} />
            阅读
          </button>
          <button
            onClick={onDiscuss}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            title="在对话中修改这章"
          >
            <MessageSquare size={12} />
            在对话中讨论
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ onGoChat }: { readonly onGoChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border/40 rounded-lg">
      <ScrollText size={28} className="text-muted-foreground/40 mb-3" />
      <h3 className="text-base text-muted-foreground">还没有章节</h3>
      <p className="text-sm text-muted-foreground/70 mt-1">到写作工作台让 agent 写第一章。</p>
      <button
        onClick={onGoChat}
        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <MessageSquare size={14} />
        进入写作工作台
      </button>
    </div>
  );
}

// Re-export for compatibility with any lingering BookDetail import sites.
export { ChapterList as BookDetail };
