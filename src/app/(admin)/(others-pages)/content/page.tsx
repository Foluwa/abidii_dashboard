import SectionHub from "@/components/admin/navigation/SectionHub";

const contentLinks = [
  { label: "Content Library", href: "/content/library" },
  { label: "Learning Items", href: "/content/learning-items" },
  { label: "Languages", href: "/content/languages" },
  { label: "Imports", href: "/content/imports" },
];

export default function ContentHubPage() {
  return (
    <SectionHub
      title="Content"
      description="Editorial workspace for language content, learning items, languages, and imports."
      links={contentLinks}
      variant="compact"
    />
  );
}
