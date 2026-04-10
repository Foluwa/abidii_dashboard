import SectionHub from "@/components/admin/navigation/SectionHub";

const libraryLinks = [
  { label: "Words", href: "/content/library/words" },
  { label: "Phrases", href: "/content/library/phrases" },
  { label: "Time Phrases", href: "/content/library/time-phrases" },
  { label: "Sentences", href: "/content/library/sentences" },
  { label: "Proverbs", href: "/content/library/proverbs" },
  { label: "Letters", href: "/content/library/letters" },
  { label: "Numbers", href: "/content/library/numbers" },
  { label: "Games View", href: "/content/library/games" },
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
