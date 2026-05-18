import SectionHub from "@/components/admin/navigation/SectionHub";

const mediaLinks = [
  { label: "Voices", href: "/audio/voices" },
  { label: "Audio Jobs", href: "/audio/jobs" },
  { label: "Audio Generate", href: "/audio/generate" },
  { label: "Orphan Assets", href: "/content/audit-log/orphan-assets" },
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
