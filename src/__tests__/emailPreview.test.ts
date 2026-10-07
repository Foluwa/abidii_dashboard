import { pinEmailColorScheme } from "@/lib/emailPreview";

const HTML = `<html><head><meta name="color-scheme" content="light dark"><style>
  @media (prefers-color-scheme: dark) { .eb-body { background-color:#0B1220 !important; } }
</style></head><body class="eb-body">Hi</body></html>`;

describe("pinEmailColorScheme", () => {
  it("applies the dark rules unconditionally in dark mode", () => {
    const out = pinEmailColorScheme(HTML, "dark");
    expect(out).toContain("@media all {");
    expect(out).not.toMatch(/prefers-color-scheme/);
    expect(out).toContain("<style>:root{color-scheme:dark}</style>");
  });

  it("disables the dark rules in light mode", () => {
    const out = pinEmailColorScheme(HTML, "light");
    expect(out).toContain("@media not all {");
    expect(out).toContain("color-scheme:light");
  });

  it("handles light-scheme queries and HTML without a head", () => {
    const out = pinEmailColorScheme("<p>x</p><style>@media (prefers-color-scheme:light){p{color:red}}</style>", "dark");
    expect(out.startsWith("<style>:root{color-scheme:dark}</style>")).toBe(true);
    expect(out).toContain("@media not all{");
  });
});
