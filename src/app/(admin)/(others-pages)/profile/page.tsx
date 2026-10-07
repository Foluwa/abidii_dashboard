"use client";

import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import React from "react";

export default function Profile() {
  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-foreground lg:mb-7">
          Profile
        </h3>
        <div className="space-y-6">
          <UserMetaCard />
          <UserInfoCard />
        </div>
      </div>
    </div>
  );
}
