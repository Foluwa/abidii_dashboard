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
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => goToPage(safeCurrentPage - 1)}
        disabled={safeCurrentPage === 1}
        className="flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
      >
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pageItems.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-sm text-gray-500 dark:text-gray-400">
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
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                safeCurrentPage === page
                  ? "bg-brand-600 text-white"
                  : "text-gray-700 hover:bg-blue-500/[0.08] hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-500"
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
        className="flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
