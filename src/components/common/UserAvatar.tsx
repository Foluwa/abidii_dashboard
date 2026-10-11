"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Award } from "lucide-react";
import { cleanSvgForDisplay, getAvatarColor, getInitials } from "@/lib/svg-utils";

export interface UserAvatarUser {
  id?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_svg?: string | null;
  picture_url?: string | null;
  has_premium?: boolean | null;
}

/**
 * Shared user avatar: generated `avatar_svg` first, then `picture_url`
 * (both normalised through cleanSvgForDisplay and rendered via <img>, never
 * inlined), falling back to coloured initials when neither is set or the
 * image fails to load.
 */
export function UserAvatar({
  user,
  size = "w-10 h-10",
  showPremiumBadge = true,
}: {
  user: UserAvatarUser;
  size?: string;
  showPremiumBadge?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const source = cleanSvgForDisplay(user.avatar_svg) || cleanSvgForDisplay(user.picture_url) || null;
  const label = user.display_name || user.username || user.email || "User";

  return (
    <div className="relative inline-flex shrink-0">
      {source && !failed ? (
        <Image
          src={source}
          alt={`${label} avatar`}
          width={40}
          height={40}
          unoptimized
          className={`${size} rounded-full object-cover bg-muted`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={`${size} rounded-full ${getAvatarColor(user.id || label)} flex items-center justify-center`}
          aria-hidden="true"
        >
          <span className="font-semibold text-sm text-white">{getInitials(label)}</span>
        </div>
      )}
      {showPremiumBadge && user.has_premium && (
        <span
          className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-amber-400 text-amber-950 shadow-sm"
          title="Premium member"
          aria-label="Premium member"
        >
          <Award className="h-3 w-3" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

export default UserAvatar;
