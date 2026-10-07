"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TabActivityContext } from "@/components/ui/tab-activity";

export interface UrlTab {
  key: string;
  label: string;
  /**
   * When explicitly false the tab is never mounted: its nav link may still be
   * rendered (or hidden by the caller) but a direct `?tab=` URL renders an
   * access-denied state and never mounts content or fires its data requests.
   */
  allowed?: boolean;
}

interface UrlTabsProps {
  tabs: UrlTab[];
  /** Documented default tab key (selected when `?tab` is absent). */
  defaultKey: string;
  /** Query-parameter name. Default "tab". Nested hubs should use a distinct name. */
  param?: string;
  className?: string;
  navClassName?: string;
  /**
   * Renders one tab's content. `isActive` lets a tab pause its polling /
   * background work while hidden. Tabs are mounted lazily on first visit and
   * kept mounted afterwards (state preserved); hidden panels use the `hidden`
   * attribute so they are not focusable.
   *
   * `hidden` also hides any inline overlay (e.g. the dashboard's custom `Modal`,
   * which renders a `fixed inset-0` element in-place rather than through a
   * portal). It does NOT hide overlays rendered through a React portal
   * (`createPortal` / Radix Dialog) — if a tab ever uses one, it must close it
   * when `isActive` becomes false. No current hub tab uses a portal.
   */
  renderTab: (key: string, isActive: boolean) => React.ReactNode;
}

export function UrlTabs({
  tabs,
  defaultKey,
  param = "tab",
  className,
  navClassName,
  renderTab,
}: UrlTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const keys = tabs.map((t) => t.key);
  const fallbackTab = tabs.find((t) => t.key === defaultKey) ?? tabs[0];
  const rawTab = searchParams.get(param);

  const isKnown = rawTab != null && keys.includes(rawTab);
  const activeKey = isKnown ? (rawTab as string) : fallbackTab.key;
  const activeTab = tabs.find((t) => t.key === activeKey);
  const activeAllowed = activeTab ? activeTab.allowed !== false : true;

  // Lazily-mounted + keep-mounted tab keys.
  const [visited, setVisited] = useState<Set<string>>(() => new Set());

  // Add the active (allowed) tab on first visit. Adjusting state during render
  // is the React-documented alternative to a `setState`-in-effect.
  if (activeAllowed && !visited.has(activeKey)) {
    setVisited((prev) => {
      if (prev.has(activeKey)) return prev;
      const next = new Set(prev);
      next.add(activeKey);
      return next;
    });
  }

  // Drop retained content if its tab is removed or becomes restricted.
  const restricted = Array.from(visited).filter((key) => {
    const t = tabs.find((x) => x.key === key);
    return !t || t.allowed === false;
  });
  if (restricted.length > 0) {
    setVisited((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const key of restricted) {
        next.delete(key);
        changed = true;
      }
      return changed ? next : prev;
    });
  }

  // Unknown tab value → strip it via replace (no redirect loop: after replace
  // `rawTab` is null so this effect does not re-run).
  useEffect(() => {
    if (rawTab != null && !isKnown) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(param);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [rawTab, isKnown, param, pathname, router, searchParams]);

  const buildHref = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === fallbackTab.key) {
      params.delete(param);
    } else {
      params.set(param, key);
    }
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className={className}>
      <div className={cn("border-b border-border", navClassName)}>
        <nav
          className="-mb-px flex gap-6 overflow-x-auto"
          role="tablist"
          aria-label="Section"
        >
          {tabs.map((tab) => {
            const isActive = tab.key === activeKey;
            return (
              <Link
                key={tab.key}
                href={buildHref(tab.key)}
                scroll={false}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6">
        {!activeAllowed ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            You don&apos;t have permission to view this section.
          </div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.key === activeKey;
            if (!visited.has(tab.key)) return null;
            return (
              <TabActivityContext.Provider key={tab.key} value={isActive}>
                <div hidden={!isActive} role="tabpanel">
                  {renderTab(tab.key, isActive)}
                </div>
              </TabActivityContext.Provider>
            );
          })
        )}
      </div>
    </div>
  );
}
