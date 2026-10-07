export type EmailPreviewScheme = "light" | "dark";

/**
 * Pins a rendered email to one colour scheme for the preview iframe.
 *
 * The templates switch to dark via `@media (prefers-color-scheme: dark)`.
 * Inside an iframe that query follows the OS, not the dashboard theme, so
 * the preview never matched the dashboard. Rewriting the condition to
 * `all` (dark) or `not all` (light) makes the dark rules apply exactly when
 * asked, and the injected `color-scheme` keeps form controls/scrollbars in
 * step. The HTML that gets saved or sent is never touched.
 */
export function pinEmailColorScheme(html: string, scheme: EmailPreviewScheme): string {
  const condition = scheme === "dark" ? "all" : "not all";
  const pinned = html.replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi, (_m, which: string) =>
    which.toLowerCase() === "dark" ? condition : scheme === "light" ? "all" : "not all",
  );
  const style = `<style>:root{color-scheme:${scheme}}</style>`;
  return /<head[^>]*>/i.test(pinned)
    ? pinned.replace(/<head[^>]*>/i, (head) => head + style)
    : style + pinned;
}
