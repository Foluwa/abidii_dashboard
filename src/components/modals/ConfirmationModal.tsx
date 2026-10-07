"use client";

import React from "react";
import { ConfirmationModal as DialogConfirmation } from "@/components/ui/modal/ConfirmationModal";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

/**
 * Confirmation dialog for destructive actions (delete, deactivate, ...).
 * Keeps this module's `confirmLabel`/`cancelLabel` props and danger default,
 * rendering the shared accessible dialog from `ui/modal`.
 */
export default function ConfirmationModal({
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  ...props
}: ConfirmationModalProps) {
  return (
    <DialogConfirmation
      {...props}
      variant={variant}
      confirmText={confirmLabel}
      cancelText={cancelLabel}
    />
  );
}
