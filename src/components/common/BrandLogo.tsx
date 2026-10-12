import Image from "next/image";

/**
 * Ìjàpá's face next to the "Abidii" wordmark, the same mark as abidii.app
 * and the app's store icon. `iconOnly` is for the collapsed sidebar.
 */
export default function BrandLogo({
  iconOnly = false,
  size = 36,
  className = "",
  textClassName = "text-xl text-foreground",
}: {
  iconOnly?: boolean;
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/images/logo/ijapa-face.webp"
        alt={iconOnly ? "Abidii" : ""}
        width={size}
        height={size}
        priority
        className="rounded-xl shadow-sm ring-1 ring-black/10 dark:ring-white/10"
        style={{ width: size, height: size }}
      />
      {!iconOnly && <span className={`font-extrabold tracking-tight ${textClassName}`}>Abidii</span>}
    </span>
  );
}
