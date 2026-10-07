import React from "react";

interface PageHeaderProps {
  pageTitle: string;
  /** One-line summary under the title (muted). */
  description?: React.ReactNode;
  /** Page-level actions, aligned right on wide screens. */
  actions?: React.ReactNode;
  /** Optional element shown before the title (e.g. a back link). */
  eyebrow?: React.ReactNode;
}

/**
 * Page header in the Studio Admin layout: large tracking-tight title,
 * muted description and right-aligned actions. Named PageBreadcrumb for
 * backwards compatibility with existing pages.
 */
const PageBreadcrumb: React.FC<PageHeaderProps> = ({
  pageTitle,
  description,
  actions,
  eyebrow,
}) => {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow}
        <h1 className="text-3xl tracking-tight text-foreground">{pageTitle}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};

export default PageBreadcrumb;
