"use client";
import React, { useRef, useEffect, useId } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  isFullscreen?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseButton = true,
  isFullscreen = false,
  maxWidth = "2xl",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDialogFocus(isOpen, modalRef);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      // A nested Radix menu that handled Escape marks it defaultPrevented.
      if (event.key === "Escape" && !event.defaultPrevented) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    full: "max-w-full",
  };

  const contentClasses = isFullscreen
    ? "w-full h-full"
    : `relative w-full ${maxWidthClasses[maxWidth]} mx-4 my-8 rounded-xl border border-border bg-card shadow-2xl`;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto modal z-99999 p-4">
      {!isFullscreen && (
        <div
          className="fixed inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        ></div>
      )}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`${contentClasses} ${className ?? ""} outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-opacity hover:bg-accent hover:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        )}
        <div className="relative">
          {title && (
            <div className="px-6 pt-6 pr-14">
              <h2 id={titleId} className="text-lg font-semibold leading-none text-foreground">
                {title}
              </h2>
            </div>
          )}
          <div className={title ? "p-6" : ""}>{children}</div>
        </div>
      </div>
    </div>
  );
};
