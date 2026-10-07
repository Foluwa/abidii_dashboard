"use client";

import CountryMap from "./CountryMap";
import { useGeoDistributionLastKnown } from "@/hooks/useApi";

// ISO 3166-1 alpha-2 → display name for common codes.
const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria", GB: "United Kingdom", US: "United States", CA: "Canada",
  GH: "Ghana", ZA: "South Africa", KE: "Kenya", ET: "Ethiopia",
  TZ: "Tanzania", UG: "Uganda", RW: "Rwanda", CM: "Cameroon",
  SN: "Senegal", CI: "Côte d'Ivoire", DE: "Germany", FR: "France",
  NL: "Netherlands", BE: "Belgium", IT: "Italy", ES: "Spain",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland",
  AU: "Australia", NZ: "New Zealand", JP: "Japan", IN: "India",
  BR: "Brazil", MX: "Mexico", AR: "Argentina",
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export default function DemographicCard() {
  const { data, isLoading, total } = useGeoDistributionLastKnown(false);

  // Top 5 by count, descending
  const topCountries: { country_code: string; count: number }[] = [...(data ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const grandTotal = topCountries.reduce((s, c) => s + c.count, 0) || total || 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Customer Demographics
        </h3>
        <p className="mt-1 text-muted-foreground text-theme-sm">
          Geographic distribution of users worldwide
        </p>
      </div>

      <div className="px-4 py-6 my-6 overflow-hidden border border-border rounded-2xl bg-muted/50 sm:px-6">
        <div className="h-[212px] w-full">
          <CountryMap />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
        </div>
      ) : topCountries.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No geographic data yet.
        </p>
      ) : (
        <div className="space-y-4">
          {topCountries.map(({ country_code, count }) => {
            const pct = Math.round((count / grandTotal) * 100);
            return (
              <div key={country_code} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-8 text-xl leading-none">
                    {/* Convert ISO alpha-2 to flag emoji */}
                    {country_code
                      .toUpperCase()
                      .split("")
                      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground text-theme-sm">
                      {countryName(country_code)}
                    </p>
                    <span className="block text-muted-foreground text-theme-xs">
                      {count.toLocaleString()} {count === 1 ? "user" : "users"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 w-32">
                  <div className="relative h-2 w-full rounded-sm bg-muted">
                    <div
                      className="absolute left-0 top-0 h-full rounded-sm bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="w-10 text-right font-medium text-foreground text-theme-sm">
                    {pct}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
