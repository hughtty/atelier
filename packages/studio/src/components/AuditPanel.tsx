/**
 * AuditPanel — renders the 3-layer Atelier editorial audit result.
 *
 * Source data comes from POST /api/v1/books/:id/audit/:chapter, which now
 * routes through PipelineRunner.auditDraft (continuity → ai-tells → literary).
 * The result shape is EditorialAuditResult when `layered === true`:
 *   { issues, passed, summary,
 *     continuityIssues, literaryIssues, aiTellIssues }
 * Pre-EditorialAuditor results fall back to a single flat issues list.
 */

import { useState } from "react";
import { fetchJson } from "../hooks/use-api";
import {
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Layers,
} from "lucide-react";

interface AuditIssue {
  readonly severity: "critical" | "warning" | "info";
  readonly category: string;
  readonly description: string;
  readonly suggestion: string;
}

interface AuditResult {
  readonly passed: boolean;
  readonly summary: string;
  readonly issues: ReadonlyArray<AuditIssue>;
  readonly continuityIssues?: ReadonlyArray<AuditIssue>;
  readonly literaryIssues?: ReadonlyArray<AuditIssue>;
  readonly aiTellIssues?: ReadonlyArray<AuditIssue>;
  readonly layered?: boolean;
  readonly overallScore?: number;
}

const SEVERITY: Record<AuditIssue["severity"], { readonly color: string; readonly icon: React.ReactNode; readonly label: string }> = {
  critical: { color: "text-destructive bg-destructive/10 border-destructive/30", icon: <AlertCircle size={12} />, label: "critical" },
  warning: { color: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: <AlertTriangle size={12} />, label: "warning" },
  info: { color: "text-blue-600 bg-blue-500/10 border-blue-500/30", icon: <Info size={12} />, label: "info" },
};

export function AuditPanel({
  bookId,
  chapterNumber,
}: {
  readonly bookId: string;
  readonly chapterNumber: number;
}) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetchJson<AuditResult & { error?: string }>(
        `/books/${bookId}/audit/${chapterNumber}`,
        { method: "POST" },
      );
      if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border border-border/50 rounded-2xl p-6 bg-card/30 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h3 className="font-medium">编辑审计 (Editorial)</h3>
          <span className="text-xs text-muted-foreground">连续性 + 文学 20 维 + 反 AI 痕迹</span>
        </div>
        <button
          onClick={handleAudit}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
          {running ? "审计中..." : result ? "重新审计" : "运行审计"}
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-destructive bg-destructive/10 rounded border border-destructive/30">
          <AlertCircle className="inline mr-1" size={12} />
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Verdict banner */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            result.passed
              ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-700"
              : "bg-destructive/5 border-destructive/30 text-destructive"
          }`}>
            {result.passed ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <div className="flex-1 text-sm">
              <div className="font-medium">{result.passed ? "通过" : "未通过（含关键问题）"}</div>
              <div className="text-xs opacity-80 mt-0.5">{result.summary}</div>
            </div>
            {result.overallScore !== undefined && (
              <div className="text-2xl font-mono font-bold">{result.overallScore}</div>
            )}
          </div>

          {/* Layered groups when EditorialAuditor result */}
          {result.layered ? (
            <div className="space-y-4">
              <Group
                title="连续性 (Continuity)"
                desc="OOC / 时间线 / 设定冲突 / 伏笔 / 节奏 / 文风 等 InkOS 经典维度"
                icon={<Layers size={14} className="text-primary" />}
                issues={result.continuityIssues ?? []}
              />
              <Group
                title="文学维度 (Literary)"
                desc="主题一致性 / 心理深度 / 矛盾性 / 群像独立 / 意象网络 / 留白与克制 / 节奏呼吸 / 对话潜台词 / 感官具体 / 结局承认丧失"
                icon={<Sparkles size={14} className="text-primary" />}
                issues={result.literaryIssues ?? []}
              />
              <Group
                title="反 AI 痕迹 (Anti-AI-trace)"
                desc="段落均匀 / 套话密度 / 公式化转折 / 列表式结构 / 戏剧化标记词 / 分析报告体 / 机械对仗 / 叙述者越界 / 破折号"
                icon={<ShieldCheck size={14} className="text-primary" />}
                issues={result.aiTellIssues ?? []}
              />
            </div>
          ) : (
            // Fallback: flat list (pre-EditorialAuditor results)
            <IssueList issues={result.issues} />
          )}
        </>
      )}
    </div>
  );
}

function Group({
  title,
  desc,
  icon,
  issues,
}: {
  readonly title: string;
  readonly desc: string;
  readonly icon: React.ReactNode;
  readonly issues: ReadonlyArray<AuditIssue>;
}) {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;
  return (
    <div className="border border-border/40 rounded-lg p-3 bg-background/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-sm font-medium">{title}</h4>
          <span className="text-xs text-muted-foreground">· 共 {issues.length} 条</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {critical > 0 && <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{critical} critical</span>}
          {warning > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">{warning} warning</span>}
          {info > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">{info} info</span>}
          {issues.length === 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">通过</span>}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-2">{desc}</p>
      {issues.length > 0 && <IssueList issues={issues} />}
    </div>
  );
}

function IssueList({ issues }: { readonly issues: ReadonlyArray<AuditIssue> }) {
  // Sort by severity descending
  const order: Record<AuditIssue["severity"], number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div className="space-y-1.5">
      {sorted.map((issue, i) => {
        const sev = SEVERITY[issue.severity];
        return (
          <details key={i} className={`text-xs border rounded p-2 ${sev.color}`}>
            <summary className="cursor-pointer flex items-center gap-2 select-none">
              <span className="inline-flex items-center gap-1">{sev.icon}<span className="font-mono">{sev.label}</span></span>
              <span className="font-medium">{issue.category}</span>
              <span className="text-muted-foreground/90 truncate flex-1">{issue.description.slice(0, 80)}{issue.description.length > 80 ? "…" : ""}</span>
            </summary>
            <div className="mt-2 ml-5 space-y-1 text-[11px]">
              <div><span className="text-muted-foreground/80">说明：</span>{issue.description}</div>
              {issue.suggestion && <div><span className="text-muted-foreground/80">建议：</span>{issue.suggestion}</div>}
            </div>
          </details>
        );
      })}
    </div>
  );
}
