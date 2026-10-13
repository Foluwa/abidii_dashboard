"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { maskEmail } from "@/lib/maskEmail";

/**
 * A learner's email, masked by default ("fo••••@abidii.app"). The eye
 * button reveals this one address until the page is reloaded, so emails
 * don't sit in full on screen, in screenshots or in screen shares.
 */
export default function MaskedEmail({
  email,
  empty = "No email",
  className = "",
}: {
  email: string | null | undefined;
  empty?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  if (!email) return <span className={className}>{empty}</span>;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <span className="truncate" data-testid="masked-email">
        {shown ? email : maskEmail(email)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          // Inside clickable rows, buttons and checkbox labels: only toggle.
          e.preventDefault();
          e.stopPropagation();
          setShown((s) => !s);
        }}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
        aria-label={shown ? "Hide email" : "Show email"}
        title={shown ? "Hide email" : "Show email"}
      >
        {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
