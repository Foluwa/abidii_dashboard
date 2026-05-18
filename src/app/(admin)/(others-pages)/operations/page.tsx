import SectionHub from "@/components/admin/navigation/SectionHub";

const operationsLinks = [
  { label: "Status", href: "/system/status" },
  { label: "Metrics", href: "/system/metrics" },
  { label: "Alerts", href: "/system/alerts" },
  { label: "Cron Jobs", href: "/system/cron" },
  { label: "ML Training", href: "/operations/ml-training" },
  { label: "Configuration", href: "/system/configuration" },
  { label: "Audit Log", href: "/content/audit-log" },
  { label: "Testing", href: "/system/testing" },
];

export default function OperationsHubPage() {
  return (
    <SectionHub
      title="Operations"
      description="Platform monitoring, observability, configuration, and internal tools."
      links={operationsLinks}
      variant="compact"
    />
  );
}
