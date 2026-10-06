export type ChartThemeMode = "light" | "dark";

/**
 * Shared ApexCharts theming helper.
 *
 * Charts render inside a browser-only client component and cannot rely on
 * Tailwind `dark:` variants for SVG/label colors, so this returns concrete
 * hex values keyed off the active ThemeContext mode. Keeps one palette +
 * font stack so every chart (named components and inline pages) stays
 * consistent and switches correctly in dark mode.
 */
export function chartTheme(theme: ChartThemeMode) {
  const isDark = theme === "dark";
  return {
    fontFamily: '"Inter", "Noto Sans", sans-serif',
    /** axis/tooltip/legend secondary text */
    text: isDark ? "#a1a1aa" : "#64748b",
    /** primary text inside tooltips/labels */
    heading: isDark ? "#e4e4e7" : "#1f2937",
    /** grid / border lines */
    grid: isDark ? "#27272a" : "#e5e7eb",
    /** categorical series palette (brand + Studio Admin accents) */
    colors: ["#465fff", "#10b981", "#f79009", "#7a5af8", "#ee46bc"],
  };
}
