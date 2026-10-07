"use client";

import { useAuth } from "@/context/AuthContext";
import { AuditLogContent } from "@/components/content/AuditLogContent";
import { OrphanAssetsContent } from "@/components/content/OrphanAssetsContent";
import { ReportsContent } from "@/components/content/ReportsContent";
import { ContentSafetyContent } from "@/components/content/ContentSafetyContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

export default function ContentOpsPage() {
  const { isAdmin } = useAuth();

  const TABS: UrlTab[] = [
    { key: "audit", label: "Audit Log" },
    { key: "orphans", label: "Orphan Assets" },
    { key: "reports", label: "Content Reports" },
    { key: "safety", label: "Content Safety", allowed: isAdmin },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight text-foreground">
          Content Ops
        </h1>
        <p className="text-sm text-muted-foreground">
          Audit logs, orphan assets, reports, and content safety
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="audit"
        renderTab={(key, isActive) => {
          if (key === "orphans") {
            return <OrphanAssetsContent showHeader={false} isActive={isActive} />;
          }
          if (key === "reports") {
            return <ReportsContent showHeader={false} />;
          }
          if (key === "safety") {
            return <ContentSafetyContent showHeader={false} />;
          }
          return <AuditLogContent showHeader={false} />;
        }}
      />
    </div>
  );
}
