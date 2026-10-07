"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { UserDetailPanel } from "@/components/admin/users/UserDetailPanel";
import { ArrowLeft } from "lucide-react";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          title="Go back"
          className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/50"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <PageBreadCrumb pageTitle="User Details" />
      </div>

      <UserDetailPanel
        userId={userId}
        onActionComplete={(action) => {
          if (action === "delete" || action === "purge") {
            router.push("/users");
          }
        }}
      />
    </div>
  );
}
