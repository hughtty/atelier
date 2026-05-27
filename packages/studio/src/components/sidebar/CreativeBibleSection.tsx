/**
 * CreativeBibleSection — a card inside BookSidebar that surfaces the 6
 * Atelier literary truth files (主题 / 人物 / 意象 / 社会 / 节奏 / 历史)
 * as compact reference content while the author writes.
 *
 * Lives next to ChaptersSection, CharacterSection, FoundationSection,
 * SummarySection. Uses the shared SidebarCard pattern so it inherits
 * collapse / spacing / typography from the rest of the right-rail.
 *
 * Edit / re-generate stays in BookSettings (low frequency) — this section
 * is read-only quick reference.
 */

import { SidebarCard } from "./SidebarCard";
import { useApi } from "../../hooks/use-api";
import { BookOpenCheck, ChevronRight, FileWarning } from "lucide-react";

interface Availability {
  readonly thematic: boolean;
  readonly characters: boolean;
  readonly symbols: boolean;
  readonly social: boolean;
  readonly rhythm: boolean;
  readonly historical: boolean;
}

interface ThematicData {
  readonly core_proposition?: string;
  readonly value_tensions?: Array<{ pole_a: string; pole_b: string }>;
  readonly forbidden_resolutions?: string[];
}
interface CharData { readonly characters?: Array<{ id: string; name: string; tier: string; contradiction: string }> }
interface SymData { readonly core_images?: Array<{ id: string; image: string; domain: string; current_state: string }> }
interface SocData {
  readonly economic?: { description?: string; scarcities?: string[] };
  readonly geography?: { primary_locations?: string[] };
}
interface HistData {
  readonly era_range?: string;
  readonly primary_setting?: string;
  readonly social_mood?: string;
  readonly anachronism_guard?: string[];
}
interface Wrap<T> { readonly exists: boolean; readonly data: T | null }

export function CreativeBibleSection({
  bookId,
  onOpenSettings,
}: {
  readonly bookId: string;
  readonly onOpenSettings: () => void;
}) {
  const { data: summary } = useApi<{ availability: Availability; anyPresent: boolean }>(
    `/books/${bookId}/literary-truth`,
  );
  const availability = summary?.availability;
  const presentCount = availability ? Object.values(availability).filter(Boolean).length : 0;

  const actions = (
    <button
      onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-muted/30 transition-colors"
      title="在书籍设置中编辑"
    >
      编辑<ChevronRight size={10} />
    </button>
  );

  return (
    <SidebarCard
      title={`创作圣经${availability ? ` · ${presentCount}/6` : ""}`}
      defaultOpen={presentCount > 0}
      actions={actions}
    >
      {!summary?.anyPresent ? (
        <EmptyHint onOpenSettings={onOpenSettings} />
      ) : (
        <div className="space-y-3">
          {availability?.thematic && <ThemeBlock bookId={bookId} />}
          {availability?.characters && <CharactersBlock bookId={bookId} onOpenSettings={onOpenSettings} />}
          {availability?.symbols && <SymbolsBlock bookId={bookId} />}
          {availability?.social && <SocialBlock bookId={bookId} />}
          {availability?.historical && <HistoricalBlock bookId={bookId} />}
          {/* narrative_rhythm is manually edited only; not auto-shown unless present */}
        </div>
      )}
    </SidebarCard>
  );
}

// ---------------------------------------------------------------------------
// Per-file mini-blocks (each fetches its own JSON)
// ---------------------------------------------------------------------------

function ThemeBlock({ bookId }: { readonly bookId: string }) {
  const { data } = useApi<Wrap<ThematicData>>(`/books/${bookId}/literary-truth/thematic_framework`);
  const d = data?.data;
  if (!d) return null;
  return (
    <Block label="主题" tone="primary">
      <p className="text-[12px] leading-relaxed">{d.core_proposition}</p>
      {d.value_tensions && d.value_tensions.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {d.value_tensions.slice(0, 3).map((v, i) => (
            <div key={i} className="text-[11px] text-muted-foreground">
              {v.pole_a} ↔ {v.pole_b}
            </div>
          ))}
        </div>
      )}
      {d.forbidden_resolutions && d.forbidden_resolutions.length > 0 && (
        <details className="mt-1.5">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
            禁忌解 ({d.forbidden_resolutions.length})
          </summary>
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {d.forbidden_resolutions.map((r, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-destructive shrink-0">✗</span><span>{r}</span></li>
            ))}
          </ul>
        </details>
      )}
    </Block>
  );
}

function CharactersBlock({ bookId, onOpenSettings }: { readonly bookId: string; readonly onOpenSettings: () => void }) {
  const { data } = useApi<Wrap<CharData>>(`/books/${bookId}/literary-truth/character_psychology`);
  const chars = data?.data?.characters;
  if (!chars || chars.length === 0) return null;
  return (
    <Block label={`人物 · ${chars.length}`}>
      <div className="space-y-1.5">
        {chars.slice(0, 5).map((ch) => (
          <div key={ch.id} className="text-[11px]">
            <div className="flex items-baseline gap-1.5">
              <span className="font-medium text-foreground">{ch.name}</span>
              <span className="text-[10px] px-1 py-0 rounded bg-muted/40 text-muted-foreground">{ch.tier}</span>
            </div>
            <p className="text-muted-foreground leading-snug mt-0.5">{ch.contradiction}</p>
          </div>
        ))}
        {chars.length > 5 && (
          <button onClick={onOpenSettings} className="text-[11px] text-muted-foreground hover:text-primary">
            · 还有 {chars.length - 5} 个 →
          </button>
        )}
      </div>
    </Block>
  );
}

function SymbolsBlock({ bookId }: { readonly bookId: string }) {
  const { data } = useApi<Wrap<SymData>>(`/books/${bookId}/literary-truth/symbolic_network`);
  const imgs = data?.data?.core_images;
  if (!imgs || imgs.length === 0) return null;
  return (
    <Block label={`意象 · ${imgs.length}`}>
      <div className="flex flex-wrap gap-1">
        {imgs.map((img) => (
          <span
            key={img.id}
            className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_CLASSES[img.current_state] ?? "bg-muted/40 text-muted-foreground"}`}
            title={`${img.domain} · ${img.current_state}`}
          >
            {img.image}
          </span>
        ))}
      </div>
    </Block>
  );
}

function SocialBlock({ bookId }: { readonly bookId: string }) {
  const { data } = useApi<Wrap<SocData>>(`/books/${bookId}/literary-truth/social_topology`);
  const d = data?.data;
  if (!d) return null;
  return (
    <Block label="社会拓扑">
      {d.economic?.description && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{d.economic.description}</p>
      )}
      {d.economic?.scarcities && d.economic.scarcities.length > 0 && (
        <p className="text-[11px] mt-1">
          <span className="text-muted-foreground">匮乏：</span>{d.economic.scarcities.join("、")}
        </p>
      )}
      {d.geography?.primary_locations && d.geography.primary_locations.length > 0 && (
        <p className="text-[11px] mt-1">
          <span className="text-muted-foreground">场所：</span>{d.geography.primary_locations.join(" · ")}
        </p>
      )}
    </Block>
  );
}

function HistoricalBlock({ bookId }: { readonly bookId: string }) {
  const { data } = useApi<Wrap<HistData>>(`/books/${bookId}/literary-truth/historical_context`);
  const d = data?.data;
  if (!d) return null;
  return (
    <Block label="历史语境">
      <div className="text-[11px] space-y-0.5">
        {d.era_range && (<div><span className="text-muted-foreground">年代：</span>{d.era_range}</div>)}
        {d.primary_setting && (<div><span className="text-muted-foreground">地点：</span>{d.primary_setting}</div>)}
        {d.social_mood && <p className="text-muted-foreground/90 italic leading-snug mt-1">"{d.social_mood}"</p>}
        {d.anachronism_guard && d.anachronism_guard.length > 0 && (
          <details className="mt-1">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
              时代错位防护 ({d.anachronism_guard.length})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {d.anachronism_guard.map((a, i) => (
                <li key={i} className="flex gap-1"><span className="text-destructive shrink-0">✗</span><span>{a}</span></li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const STATE_CLASSES: Record<string, string> = {
  seeded: "bg-blue-500/10 text-blue-600",
  echoed: "bg-amber-500/10 text-amber-600",
  transformed: "bg-emerald-500/10 text-emerald-600",
  silent: "bg-muted/40 text-muted-foreground",
};

function Block({ label, tone, children }: { readonly label: string; readonly tone?: "primary"; readonly children: React.ReactNode }) {
  return (
    <section>
      <h5 className={`text-[10px] uppercase tracking-wider mb-1 ${tone === "primary" ? "text-primary font-medium" : "text-muted-foreground font-medium"}`}>
        {label}
      </h5>
      {children}
    </section>
  );
}

function EmptyHint({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-4 px-2">
      <FileWarning size={18} className="text-muted-foreground/60 mb-2" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        这本书还没有创作圣经
      </p>
      <p className="text-[10px] text-muted-foreground/70 mt-1 leading-relaxed">
        到「书籍设置」用 agent 生成
      </p>
      <button
        onClick={onOpenSettings}
        className="mt-2 text-[11px] px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
      >
        <BookOpenCheck size={11} /> 去配置
      </button>
    </div>
  );
}
