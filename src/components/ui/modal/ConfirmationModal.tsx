"use client";
import React from "react";
import { CircleAlert, Info, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Modal } from "./index";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

const VARIANTS = {
  danger: {
    Icon: CircleAlert,
    iconClass: "bg-destructive/10 text-destructive",
    buttonClass:
      "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
  },
  warning: {
    Icon: TriangleAlert,
    iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    buttonClass:
      "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50",
  },
  info: {
    Icon: Info,
    iconClass: "bg-muted text-foreground",
    buttonClass:
      "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50",
  },
} as const;

/**
 * Confirmation dialog in the shadcn alert-dialog layout: icon + message,
 * then right-aligned Cancel / Confirm. The parent closes it once its async
 * action finishes (onConfirm does not auto-close).
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false,
}) => {
  const v = VARIANTS[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      showCloseButton={!isLoading}
    >
      <div>
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              v.iconClass,
            )}
            aria-hidden="true"
          >
            <v.Icon className="size-5" />
          </div>
          <p className="pt-2 text-sm text-muted-foreground">{message}</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50",
              v.buttonClass,
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
