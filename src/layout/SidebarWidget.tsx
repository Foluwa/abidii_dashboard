import React from "react";

export default function SidebarWidget() {
  return (
    <div
      className={
        "mx-auto mb-10 w-full max-w-60 rounded-2xl bg-muted/50 px-4 py-5 text-center"}
    >
      <h3 className="mb-2 font-semibold text-foreground">
        Abidii Admin
      </h3>
      <p className="mb-4 text-muted-foreground text-theme-sm">
        Language Learning Platform Dashboard
      </p>
      <a
        href="https://abidii.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center p-3 font-medium text-primary-foreground rounded-lg bg-brand-500 text-theme-sm hover:bg-brand-600"
      >
        Visit Abidii
      </a>
    </div>
  );
}
