import SectionHub from "@/components/admin/navigation/SectionHub";

const overviewLinks = [
  { label: "Dashboard", href: "/dashboard", description: "System health, KPIs, and quick actions." },
  { label: "Analytics", href: "/overview/analytics", description: "Game and product analytics dashboards." },
  { label: "Player Analytics", href: "/overview/analytics/players", description: "Detailed user and player-level insights." },
  { label: "Curriculum Ops", href: "/overview/analytics/curriculum-ops", description: "Operational curriculum roll-out metrics." },
];

export default function OverviewPage() {
  return (
    <SectionHub
      title="Overview"
      description="Executive workspace for high-level monitoring and analytics."
      links={overviewLinks}
    />
  );
}
