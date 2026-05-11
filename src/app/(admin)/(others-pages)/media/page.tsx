import SectionHub from "@/components/admin/navigation/SectionHub";

const mediaLinks = [
  { label: "Media Library", href: "/media/library" },
  { label: "Voices", href: "/media/audio/voices" },
  { label: "Audio Jobs", href: "/media/audio/jobs" },
  { label: "Audio Generate", href: "/media/audio/generate" },
  { label: "Orphan Assets", href: "/media/orphan-assets" },
];

export default function MediaHubPage() {
  return (
    <SectionHub
      title="Media"
      description="Unified audio and asset operations workspace."
      links={mediaLinks}
    />
  );
}
