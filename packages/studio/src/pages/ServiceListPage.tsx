import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X, Sparkles } from "lucide-react";
import { GROUP_LABELS, GROUP_ORDER, GROUP_SHORT_LABELS } from "../constants/service-groups";
import { useServiceStore } from "../store/service";
import type { EndpointGroup, ServiceInfo } from "../store/service";
import { useApi, putApi } from "../hooks/use-api";

interface Nav {
  toDashboard: () => void;
  toServiceDetail: (id: string) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border/30 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="w-2 h-2 rounded-full bg-muted" />
      </div>
      <div className="h-3 w-16 bg-muted/60 rounded" />
    </div>
  );
}

function ServiceCard({
  svc,
  onClick,
  isActive,
  defaultModel,
  onMakeActive,
}: {
  svc: ServiceInfo;
  onClick: () => void;
  isActive: boolean;
  defaultModel: string | null;
  onMakeActive?: () => void;
}) {
  return (
    <div
      className={[
        "relative flex min-h-[110px] flex-col gap-2 rounded-lg border p-5 text-left transition-all",
        isActive
          ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/10"
          : svc.connected
            ? "border-emerald-500/30 bg-emerald-500/[0.03]"
            : "border-dashed border-border/40",
      ].join(" ")}
    >
      {/* Active marker — top-right */}
      {isActive && (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-primary text-primary-foreground">
          <Sparkles size={9} />
          使用中
        </span>
      )}

      <button onClick={onClick} className="text-left">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="truncate text-sm font-medium hover:text-primary transition-colors">{svc.label}</span>
          {!isActive && (
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${svc.connected ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
          )}
        </div>
        <span className="text-xs text-muted-foreground/60">
          {svc.connected ? "已连接" : "未配置"}
        </span>
      </button>

      {/* Default model line */}
      {svc.connected && defaultModel && (
        <div className="mt-auto pt-1 text-[11px] font-mono text-muted-foreground truncate">
          {defaultModel}
        </div>
      )}

      {/* "Make active" button when connected but not active */}
      {svc.connected && !isActive && onMakeActive && (
        <button
          onClick={onMakeActive}
          className="absolute bottom-2 right-2 text-[10px] text-primary hover:underline"
          title="切换为当前活动模型服务"
        >
          切为默认 →
        </button>
      )}
    </div>
  );
}

export function ServiceListPage({ nav }: { nav: Nav }) {
  const services = useServiceStore((s) => s.services);
  const loading = useServiceStore((s) => s.servicesLoading);
  const fetchServices = useServiceStore((s) => s.fetchServices);

  useEffect(() => { void fetchServices(); }, [fetchServices]);

  // Active service + per-service default model (UX 3 — model overview).
  const { data: cfg, refetch: refetchCfg } = useApi<{
    service: string | null;
    defaultModel: string | null;
    services: ReadonlyArray<{ service: string; defaultModel?: string | null; model?: string | null }>;
  }>("/services/config");

  const activeService = cfg?.service ?? null;
  // Per-service model. Studio's config stores defaultModel at top level for
  // the active service, and per-service entries may carry their own.
  const modelByService = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of cfg?.services ?? []) {
      const m = s.defaultModel ?? s.model;
      if (m) map.set(s.service, m);
    }
    // Active service's top-level defaultModel takes precedence if set.
    if (activeService && cfg?.defaultModel) map.set(activeService, cfg.defaultModel);
    return map;
  }, [cfg?.services, cfg?.defaultModel, activeService]);

  const makeActive = async (serviceId: string) => {
    await putApi("/services/config", { service: serviceId });
    void refetchCfg();
    void fetchServices();
  };

  const [query, setQuery] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<Set<EndpointGroup>>(new Set());
  const [onlyConnected, setOnlyConnected] = useState(false);

  const bankServices = useMemo(
    () => services.filter((s) => !s.service.startsWith("custom")),
    [services],
  );
  const customServices = useMemo(
    () => services.filter((s) => s.service.startsWith("custom")),
    [services],
  );

  const groupCounts = useMemo(() => {
    const counts = {} as Record<EndpointGroup, number>;
    for (const group of GROUP_ORDER) {
      counts[group] = bankServices.filter((s) => s.group === group).length;
    }
    return counts;
  }, [bankServices]);

  const connectedCount = useMemo(
    () => services.filter((s) => s.connected).length,
    [services],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bankServices.filter((svc) => {
      if (onlyConnected && !svc.connected) return false;
      if (selectedGroups.size > 0 && (!svc.group || !selectedGroups.has(svc.group))) return false;
      if (q && !svc.label.toLowerCase().includes(q) && !svc.service.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bankServices, onlyConnected, query, selectedGroups]);

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (selectedGroups.size > 0) return [];
    return customServices.filter((svc) => {
      if (onlyConnected && !svc.connected) return false;
      if (q && !svc.label.toLowerCase().includes(q) && !svc.service.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [customServices, onlyConnected, query, selectedGroups]);

  const byGroup = useMemo(() => {
    const map = {} as Record<EndpointGroup, ServiceInfo[]>;
    for (const group of GROUP_ORDER) map[group] = [];
    for (const svc of filtered) {
      if (svc.group) map[svc.group].push(svc);
    }
    return map;
  }, [filtered]);

  const toggleGroup = (group: EndpointGroup) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const canCreateCustom = selectedGroups.size === 0 && query.trim() === "" && !onlyConnected;
  const showCustomSection = !loading && selectedGroups.size === 0 && (filteredCustom.length > 0 || canCreateCustom);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={nav.toDashboard}
          className="inline-flex items-center rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 font-medium text-foreground hover:bg-secondary/50 transition-colors"
        >
          首页
        </button>
        <span className="text-border">/</span>
        <span className="text-foreground">服务商管理</span>
      </div>

      <h1 className="font-serif text-2xl">服务商管理</h1>

      {/* Active model overview banner (UX 3) */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center gap-3 flex-wrap">
        <Sparkles size={16} className="text-primary shrink-0" />
        <div className="flex-1 min-w-[180px]">
          <div className="text-xs text-muted-foreground">当前用于生成的模型</div>
          {activeService ? (
            <div className="text-sm">
              <span className="font-medium">{activeService}</span>
              <span className="text-muted-foreground mx-1.5">·</span>
              <span className="font-mono text-xs">{cfg?.defaultModel ?? "(未设置默认模型)"}</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">尚未设置活动服务</div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {connectedCount} / {bankServices.length + customServices.length} 个服务已连接
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索服务商"
          className="w-full rounded-lg border border-border/60 bg-background py-2 pl-9 pr-9 text-sm outline-none focus:border-primary/50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
            aria-label="清空搜索"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGroups(new Set())}
          className={[
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
            selectedGroups.size === 0
              ? "border-foreground bg-foreground text-background"
              : "border-border/60 text-muted-foreground hover:bg-secondary/50",
          ].join(" ")}
        >
          全部 {bankServices.length}
        </button>
        {GROUP_ORDER.map((group) => {
          const selected = selectedGroups.has(group);
          return (
            <button
              key={group}
              onClick={() => toggleGroup(group)}
              className={[
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 text-muted-foreground hover:bg-secondary/50",
              ].join(" ")}
            >
              {selected && <Check size={12} />}
              {GROUP_SHORT_LABELS[group]} {groupCounts[group]}
            </button>
          );
        })}
        {selectedGroups.size > 0 && (
          <button
            onClick={() => setSelectedGroups(new Set())}
            className="inline-flex items-center rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            清除筛选
          </button>
        )}
      </div>

      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={onlyConnected}
          onChange={(event) => setOnlyConnected(event.target.checked)}
        />
        <span>只看已连接 ({connectedCount})</span>
      </label>

      <div className="h-px bg-border/30" />

      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && GROUP_ORDER.map((group) => {
        const list = byGroup[group];
        if (!list || list.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {GROUP_LABELS[group]}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {list.map((svc) => (
                <ServiceCard
                  key={svc.service}
                  svc={svc}
                  isActive={activeService === svc.service}
                  defaultModel={modelByService.get(svc.service) ?? null}
                  onMakeActive={svc.connected && activeService !== svc.service ? () => void makeActive(svc.service) : undefined}
                  onClick={() => nav.toServiceDetail(svc.service)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {showCustomSection && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            自定义服务
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {filteredCustom.map((svc) => (
              <ServiceCard
                key={svc.service}
                svc={svc}
                isActive={activeService === svc.service}
                defaultModel={modelByService.get(svc.service) ?? null}
                onMakeActive={svc.connected && activeService !== svc.service ? () => void makeActive(svc.service) : undefined}
                onClick={() => nav.toServiceDetail(svc.service)}
              />
            ))}
            {canCreateCustom && (
              <button
                onClick={() => nav.toServiceDetail("custom")}
                className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 p-5 text-muted-foreground/60 transition-all hover:border-primary/30 hover:text-muted-foreground"
              >
                <Plus size={18} />
                <span className="text-xs">自定义服务</span>
              </button>
            )}
          </div>
        </section>
      )}

      {!loading && filtered.length === 0 && filteredCustom.length === 0 && !canCreateCustom && (
        <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          没有匹配的服务商
        </div>
      )}
    </div>
  );
}
