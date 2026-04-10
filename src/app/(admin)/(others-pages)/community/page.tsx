import SectionHub from "@/components/admin/navigation/SectionHub";

const communityLinks = [
  { label: "All Users", href: "/community/users" },
  { label: "Admins", href: "/community/users/admins" },
  { label: "Subscriptions", href: "/community/billing" },
  { label: "Billing Events", href: "/community/billing/events" },
  { label: "Verification Attempts", href: "/community/billing/verification-attempts" },
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
