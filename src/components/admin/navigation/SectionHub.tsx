import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";

export type SectionHubLink = {
  label: string;
  href: string;
  description?: string;
};

type SectionHubProps = {
  title: string;
  description: string;
  links: SectionHubLink[];
  variant?: "card" | "compact";
  gridClassName?: string;
};

export default function SectionHub({
  title,
  description,
  links,
  variant = "card",
  gridClassName,
}: SectionHubProps) {
  const resolvedGridClassName =
    gridClassName ??
    (variant === "compact"
      ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      : "grid grid-cols-1 gap-4 md:grid-cols-2");

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle={title} />
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      <div className={resolvedGridClassName}>
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              variant === "compact"
                ? "rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                : "rounded-xl border border-gray-200 bg-white p-5 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
            }
          >
            {variant === "compact" ? (
              item.label
            ) : (
              <>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                {item.description ? (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                ) : null}
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
