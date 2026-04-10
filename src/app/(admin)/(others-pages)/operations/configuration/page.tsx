import SectionHub from "@/components/admin/navigation/SectionHub";

const configLinks = [
  { label: "Platform", href: "/operations/configuration/platform" },
  { label: "Application", href: "/operations/configuration/application" },
  { label: "Language", href: "/operations/configuration/language" },
];

export default function OperationsConfigurationPage() {
  return (
    <SectionHub
      title="Configuration"
      description="Centralized access to platform and app-level configuration."
      links={configLinks}
      variant="compact"
      gridClassName="grid grid-cols-1 gap-3 md:grid-cols-3"
    />
  );
}
