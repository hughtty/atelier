/**
 * Tool-result cards — detect structured outcomes inside a ToolExecution's
 * text result and render them as rich, actionable cards next to the
 * collapsed tool-step summary.
 *
 * Detection is purely string-based against the result text emitted by the
 * core sub_agent tool (see core/src/agent/agent-tools.ts ::SubAgentParams
 * branches). This avoids changes to pi-agent-core's serialization layer.
 *
 * Three card kinds are supported in Atelier:
 *   - chapter card   (written-by-writer)
 *   - audit card     (audited-by-auditor)
 *   - book card      (created-by-architect)
 */

import type { ToolExecution } from "../../store/chat/types";
import {
  PenLine,
  ScrollText,
  Layers,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  RotateCcw,
} from "lucide-react";

interface ToolResultCardProps {
  readonly execution: ToolExecution;
  readonly bookId?: string;
  readonly onSendCommand: (command: string) => void;
  readonly onOpenChapter: (chapter: number) => void;
}

// ---------------------------------------------------------------------------
// Public entry point — call from message renderer right after the tool steps
// ---------------------------------------------------------------------------

export function ToolResultCard(props: ToolResultCardProps): React.ReactNode {
  const { execution } = props;
  if (execution.status !== "completed" || !execution.result) return null;

  const text = execution.result;

  // Order matters: more specific patterns first.
  const audit = detectAudit(text);
  if (audit) return <AuditCardView {...audit} {...props} />;

  const chapter = detectChapter(text);
  if (chapter) return <ChapterCardView {...chapter} {...props} />;

  const book = detectBook(text);
  if (book) return <BookCreatedCardView {...book} {...props} />;

  return null;
}

// ---------------------------------------------------------------------------
// Pattern detectors
// ---------------------------------------------------------------------------

interface ChapterPayload {
  readonly bookId: string;
  readonly wordCount?: number;
}
function detectChapter(text: string): ChapterPayload | null {
  // "Chapter written for "test-river". Word count: 1893."
  const m = text.match(/Chapter\s+written\s+for\s+"([^"]+)"\.?\s*(?:Word count:\s*(\d+|unknown))?/i);
  if (!m) return null;
  const wc = m[2] && m[2] !== "unknown" ? parseInt(m[2], 10) : undefined;
  return { bookId: m[1]!, wordCount: wc };
}

interface AuditPayload {
  readonly chapterNumber: number;
  readonly passed: boolean;
  readonly issueCount: number;
  readonly issues: ReadonlyArray<{ readonly severity: "critical" | "warning" | "info"; readonly text: string }>;
}
function detectAudit(text: string): AuditPayload | null {
  // "Audit chapter 1: FAILED, 22 issue(s).\n[critical] ...\n[warning] ..."
  const head = text.match(/Audit\s+chapter\s+(\d+):\s*(PASSED|FAILED),\s*(\d+)\s+issue/i);
  if (!head) return null;
  const chapterNumber = parseInt(head[1]!, 10);
  const passed = head[2]!.toUpperCase() === "PASSED";
  const issueCount = parseInt(head[3]!, 10);

  // Parse the rest as severity-prefixed lines: "[critical] ..."
  const issueRe = /^\[(critical|warning|info)\]\s+(.*)$/gim;
  const issues: Array<{ severity: "critical" | "warning" | "info"; text: string }> = [];
  let issueMatch: RegExpExecArray | null;
  while ((issueMatch = issueRe.exec(text)) !== null) {
    issues.push({ severity: issueMatch[1] as "critical" | "warning" | "info", text: issueMatch[2]!.trim() });
  }
  return { chapterNumber, passed, issueCount, issues };
}

interface BookPayload {
  readonly title: string;
  readonly bookId: string;
}
function detectBook(text: string): BookPayload | null {
  // 'Book "河边" (test-river) initialised successfully. Foundation files are ready.'
  const m = text.match(/Book\s+"([^"]+)"\s*\(([^)]+)\)\s*initialised/i);
  if (!m) return null;
  return { title: m[1]!, bookId: m[2]! };
}

// ---------------------------------------------------------------------------
// Card views
// ---------------------------------------------------------------------------

function ChapterCardView(props: ChapterPayload & ToolResultCardProps) {
  const { wordCount, onSendCommand } = props;
  // Chapter number is not in the writer's result text — use last-written guidance.
  return (
    <div className="my-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PenLine size={16} className="text-primary" />
          <h4 className="font-medium text-sm">新章节已写完</h4>
          {wordCount !== undefined && (
            <span className="text-xs text-muted-foreground">· {wordCount.toLocaleString()} 字</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        草稿已保存到磁盘，状态：等待审阅。建议先阅读再决定是否运行审计。
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <CardButton
          icon={<ScrollText size={12} />}
          label="查看章节列表"
          onClick={() => onSendCommand("显示本书所有章节")}
        />
        <CardButton
          icon={<Layers size={12} />}
          label="运行审计"
          onClick={() => onSendCommand("审计这一章")}
          primary
        />
      </div>
    </div>
  );
}

function AuditCardView(props: AuditPayload & ToolResultCardProps) {
  const { chapterNumber, passed, issueCount, issues, onOpenChapter, onSendCommand } = props;
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;

  return (
    <div className="my-3 rounded-lg border border-border bg-card/30 p-4 space-y-3">
      {/* Verdict */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h4 className="font-medium text-sm">编辑审计 · 第 {chapterNumber} 章</h4>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          passed
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-destructive/10 text-destructive"
        }`}>
          {passed ? (<><CheckCircle2 size={11} className="inline mr-1" />通过</>) : (<><AlertCircle size={11} className="inline mr-1" />未通过</>)}
        </span>
      </div>

      {/* Issue stats */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">共 {issueCount} 条：</span>
        {critical > 0 && <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive flex items-center gap-1"><AlertCircle size={10} />{critical} critical</span>}
        {warning > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 flex items-center gap-1"><AlertTriangle size={10} />{warning} warning</span>}
        {info > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 flex items-center gap-1"><Info size={10} />{info} info</span>}
        {issueCount === 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">无问题</span>}
      </div>

      {/* Top critical/warning issues (max 5) */}
      {issues.length > 0 && (
        <details open={critical > 0} className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            查看 issue 详情
          </summary>
          <ul className="mt-2 space-y-1.5">
            {issues.slice(0, 8).map((issue, i) => (
              <li key={i} className={`p-2 rounded border text-xs ${SEVERITY_STYLE[issue.severity]}`}>
                <span className="font-mono text-[10px] mr-2 opacity-70">[{issue.severity}]</span>
                {issue.text.length > 240 ? issue.text.slice(0, 240) + "…" : issue.text}
              </li>
            ))}
            {issues.length > 8 && (
              <li className="text-[11px] text-muted-foreground text-center">
                · 还有 {issues.length - 8} 条
              </li>
            )}
          </ul>
        </details>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <CardButton
          icon={<ScrollText size={12} />}
          label="查看章节正文"
          onClick={() => onOpenChapter(chapterNumber)}
        />
        {!passed && critical > 0 && (
          <CardButton
            icon={<RotateCcw size={12} />}
            label="一键修订关键问题"
            onClick={() => onSendCommand(`修订第 ${chapterNumber} 章的 critical 问题`)}
            primary
          />
        )}
      </div>
    </div>
  );
}

function BookCreatedCardView(props: BookPayload & ToolResultCardProps) {
  const { title, bookId, onSendCommand } = props;
  return (
    <div className="my-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h4 className="font-medium text-sm">新书《{title}》创建完成</h4>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        基础架构稿已生成。下一步建议：生成创作圣经（主题 / 人物 / 意象 / 社会），再开始写第一章。
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <CardButton
          icon={<Sparkles size={12} />}
          label="生成主题骨架"
          onClick={() => onSendCommand("生成主题骨架")}
        />
        <CardButton
          icon={<PenLine size={12} />}
          label="直接写第一章"
          onClick={() => onSendCommand("写下一章")}
          primary
        />
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">book id: {bookId}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<"critical" | "warning" | "info", string> = {
  critical: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
};

function CardButton({
  icon,
  label,
  onClick,
  primary = false,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
