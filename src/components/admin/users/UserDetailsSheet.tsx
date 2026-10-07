"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserDetailPanel } from "@/components/admin/users/UserDetailPanel";

export type UserDetailAction = "delete" | "purge" | "deactivate" | "reactivate";

interface UserDetailsSheetProps {
  userId: string | null;
  onClose: () => void;
  onActionComplete?: (action: UserDetailAction) => void;
}

/**
 * Reusable right-side drawer that shows the shared UserDetailPanel for a given
 * user, used by both the Users table and the Subscriptions page (whose "View"
 * action opens the same drawer instead of navigating to /users/[id]).
 */
export function UserDetailsSheet({ userId, onClose, onActionComplete }: UserDetailsSheetProps) {
  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto p-0 outline-none sm:max-w-2xl"
        // Focus the drawer itself (still announced, still trapped) rather than
        // painting a focus ring on the first button the moment it opens.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <SheetHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-3 border-b border-border bg-background/95 px-6 py-4 pr-14 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="min-w-0">
            <SheetTitle className="text-base">User details</SheetTitle>
            <SheetDescription className="text-xs">
              Profile, learning progress, subscription and activity
            </SheetDescription>
          </div>
          {userId && (
            <Link
              href={`/users/${userId}`}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open page
            </Link>
          )}
        </SheetHeader>
        <div className="px-6 py-5">
          {userId && (
            <UserDetailPanel userId={userId} onActionComplete={onActionComplete} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
