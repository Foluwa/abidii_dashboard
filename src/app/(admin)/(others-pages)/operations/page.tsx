import SectionHub from "@/components/admin/navigation/SectionHub";

const operationsLinks = [
  { label: "Status", href: "/operations/status" },
  { label: "Metrics", href: "/operations/metrics" },
  { label: "Alerts", href: "/operations/alerts" },
  { label: "Cron Jobs", href: "/operations/cron-jobs" },
  { label: "Idempotency", href: "/operations/idempotency" },
  { label: "Configuration", href: "/operations/configuration" },
  { label: "Audit Log", href: "/operations/audit-log" },
  { label: "Testing", href: "/operations/testing" },
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
