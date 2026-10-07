type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

type PageItem = number | "ellipsis";

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || totalPages <= 0) return 1;
  return Math.max(1, Math.min(totalPages, page));
}

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 1) return [1];

  // Small totals: show everything.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const clampedCurrent = clampPage(currentPage, totalPages);
  const items: PageItem[] = [1];

  const left = Math.max(2, clampedCurrent - 1);
  const right = Math.min(totalPages - 1, clampedCurrent + 1);

  if (left > 2) items.push("ellipsis");
  for (let page = left; page <= right; page += 1) items.push(page);
  if (right < totalPages - 1) items.push("ellipsis");

  items.push(totalPages);
  return items;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = clampPage(currentPage, safeTotalPages);
  const pageItems = getPageItems(safeCurrentPage, safeTotalPages);

  const goToPage = (page: number) => {
    onPageChange(clampPage(page, safeTotalPages));
  };

  return (
    <nav aria-label="Pagination" className={`flex items-center gap-1.5 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => goToPage(safeCurrentPage - 1)}
        disabled={safeCurrentPage === 1}
        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pageItems.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                ...
              </span>
            );
          }

          const page = item;
          return (
            <button
              key={page}
              type="button"
              onClick={() => goToPage(page)}
              aria-current={safeCurrentPage === page ? "page" : undefined}
              className={`inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-colors ${
                safeCurrentPage === page
                  ? "border border-input bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {page}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => goToPage(safeCurrentPage + 1)}
        disabled={safeCurrentPage === safeTotalPages}
        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;
