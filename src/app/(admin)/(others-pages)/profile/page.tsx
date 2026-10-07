"use client";

import React from "react";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";

export default function Profile() {
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Profile"
        description="Your admin account details."
      />
      <div className="space-y-6">
        <UserMetaCard />
        <UserInfoCard />
      </div>
    </div>
  );
}
