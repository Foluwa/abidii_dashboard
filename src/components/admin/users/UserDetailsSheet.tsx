"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
        </SheetHeader>
        {userId && (
          <UserDetailPanel userId={userId} onActionComplete={onActionComplete} />
        )}
      </SheetContent>
    </Sheet>
  );
}
