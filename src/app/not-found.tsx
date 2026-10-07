import Link from "next/link";
import React from "react";
import { FileQuestion } from "lucide-react";

/** Reference (Studio Admin) not-found page, on Abidii's neutral theme. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <FileQuestion className="mb-2 size-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Page not found.</h1>
      <p className="text-muted-foreground">
        The page you are looking for could not be found.
      </p>
      <Link
        href="/dashboard"
        replace
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
      >
        Go back to the dashboard
      </Link>
    </div>
  );
}
