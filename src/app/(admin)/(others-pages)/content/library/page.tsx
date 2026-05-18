import SectionHub from "@/components/admin/navigation/SectionHub";

const libraryLinks = [
  { label: "Words", href: "/content/words" },
  { label: "Phrases", href: "/content/phrases" },
  { label: "Time Phrases", href: "/content/time-phrases" },
  { label: "Sentences", href: "/content/sentences" },
  { label: "Proverbs", href: "/content/proverbs" },
  { label: "Letters", href: "/content/letters" },
  { label: "Numbers", href: "/content/numbers" },
  { label: "Games View", href: "/content/learning-items" },
];

export default function ContentLibraryPage() {
  return (
    <SectionHub
      title="Content Library"
      description="Browse and manage all editorial content types from one workspace."
      links={libraryLinks}
      variant="compact"
    />
  );
}
