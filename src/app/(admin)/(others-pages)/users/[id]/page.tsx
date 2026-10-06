"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { UserDetailPanel } from "@/components/admin/users/UserDetailPanel";
import { FiArrowLeft } from "react-icons/fi";

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
          className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
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
