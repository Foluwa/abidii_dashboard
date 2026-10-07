import React from "react";

type BadgeVariant = "light" | "solid";
type BadgeSize = "sm" | "md";
type BadgeColor =
  | "primary"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "light"
  | "dark";

interface BadgeProps {
  variant?: BadgeVariant; // Light or solid variant
  size?: BadgeSize; // Badge size
  color?: BadgeColor; // Badge color
  startIcon?: React.ReactNode; // Icon at the start
  endIcon?: React.ReactNode; // Icon at the end
  children: React.ReactNode; // Badge content
}

const Badge: React.FC<BadgeProps> = ({
  variant = "light",
  color = "primary",
  size = "md",
  startIcon,
  endIcon,
  children,
}) => {
  // Studio Admin badge: small rounded-md outline with a soft tint. The
  // "solid" variant keeps its API but uses the same soft treatment - the
  // reference never uses saturated filled status pills.
  const baseStyles =
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 font-medium [&>svg]:size-3";

  const sizeStyles = {
    sm: "text-xs",
    md: "text-xs",
  };

  const soft = {
    primary: "border-border bg-secondary text-secondary-foreground",
    success:
      "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300",
    error: "border-destructive/20 bg-destructive/10 text-destructive",
    warning:
      "border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/40 dark:bg-amber-500/15 dark:text-amber-300",
    info: "border-sky-200 bg-sky-500/10 text-sky-700 dark:border-sky-900/40 dark:bg-sky-500/15 dark:text-sky-300",
    light: "border-border bg-muted text-muted-foreground",
    dark: "border-border bg-muted text-muted-foreground",
  };
  const variants = { light: soft, solid: soft };

  // Get styles based on size and color variant
  const sizeClass = sizeStyles[size];
  const colorStyles = variants[variant][color];

  return (
    <span className={`${baseStyles} ${sizeClass} ${colorStyles}`}>
      {startIcon && <span className="mr-1">{startIcon}</span>}
      {children}
      {endIcon && <span className="ml-1">{endIcon}</span>}
    </span>
  );
};

export default Badge;
