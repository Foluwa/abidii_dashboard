"use client";
import React, { useEffect, useRef } from "react";
import { useDialogFocus } from "./useDialogFocus";

interface DialogPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Called on Escape. Omit when the dialog must not be dismissed that way. */
  onClose?: () => void;
}

/**
 * The panel of a page-specific overlay that does not use `Modal`. Mount it
 * only while the overlay is open: it is announced as a modal dialog, takes
 * focus, traps Tab, closes on Escape and restores focus on unmount. Label it
 * with `aria-labelledby` (the heading's id) or `aria-label`.
 */
export function DialogPanel({ onClose, className, children, ...rest }: DialogPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A nested Radix menu that handled Escape marks it defaultPrevented.
      if (event.key === "Escape" && !event.defaultPrevented) onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={`outline-none ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
