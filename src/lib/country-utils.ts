/**
 * Shared ISO 3166-1 alpha-2 country code -> display helpers.
 * Extracted from users/page.tsx's local countryName() so the user-detail
 * page can reuse the same logic instead of duplicating it.
 */

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

/** Converts a 2-letter country code to its flag emoji via Unicode Regional
 * Indicator Symbols (e.g. "NG" -> 🇳🇬). No image asset or library needed -
 * this is how flag emoji are represented at the Unicode level. */
export function countryFlagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const codePoints = [...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "";
  }
}
