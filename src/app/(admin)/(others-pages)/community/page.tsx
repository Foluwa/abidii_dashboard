import SectionHub from "@/components/admin/navigation/SectionHub";

const communityLinks = [
  { label: "All Users", href: "/users" },
  { label: "Admins", href: "/users/admins" },
  { label: "Subscriptions", href: "/subscriptions" },
];

export default function CommunityHubPage() {
  return (
    <SectionHub
      title="Community"
      description="User and billing operations in one place."
      links={communityLinks}
    />
  );
}
