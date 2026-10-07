"use client";
import React from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

// Helper to get initials from name or email
function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

// Helper to format role for display
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function UserMetaCard() {
  const { user } = useAuth();
  
  const displayName = user?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(user?.display_name || null, user?.email || null);
  const role = user?.role ? formatRole(user.role) : 'User';
  const email = user?.email || '';
  return (
    <div className="p-5 border border-border rounded-2xl lg:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
          <div className="w-20 h-20 overflow-hidden border border-border rounded-full bg-brand-600 flex items-center justify-center">
            {user?.picture_url ? (
              <Image
                src={user.picture_url}
                alt={displayName}
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-white font-semibold text-2xl">{initials}</span>
            )}
          </div>
          <div className="order-3 xl:order-2">
            <h4 className="mb-2 text-lg font-semibold text-center text-foreground xl:text-left">
              {displayName}
            </h4>
            <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
              <p className="text-sm text-muted-foreground">
                {role}
              </p>
              {email && (
                <>
                  <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                  <p className="text-sm text-muted-foreground">
                    {email}
                  </p>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
