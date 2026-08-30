"use client";

import { useCallback, useState } from "react";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based confirmation dialog, backed by the shared ConfirmationModal.
 * Lets a mutating action await user confirmation inline instead of each
 * call site managing its own open/pending-action state:
 *
 *   const { confirm, modal } = useConfirm();
 *   const onQueueTraining = async () => {
 *     if (!(await confirm({ title: "Queue Training Job", message: "..." }))) return;
 *     await api.post(...);
 *   };
 *   return <>{modal}<Button onClick={onQueueTraining} /></>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const resolvePending = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const modal = pending ? (
    <ConfirmationModal
      isOpen
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel ?? "Confirm"}
      cancelLabel={pending.cancelLabel ?? "Cancel"}
      variant={pending.variant ?? "warning"}
      onClose={() => resolvePending(false)}
      onConfirm={() => resolvePending(true)}
    />
  ) : null;

  return { confirm, modal };
}
