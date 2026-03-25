"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (message: unknown) => void;
  error: (message: unknown) => void;
  info: (message: unknown) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function formatToastMessage(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  if (message == null) {
    return "Unexpected error";
  }

  if (typeof message === "object") {
    const payload = message as Record<string, unknown>;
    const errorCode = typeof payload.error === "string" ? payload.error : null;
    const expected = payload.expected;
    const provided = payload.provided;

    if (errorCode === "section_unit_mismatch") {
      return `Section location is stale. Expected ${String(expected)}, but the page sent ${String(provided)}. Refresh and try again.`;
    }

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (typeof payload.detail === "string") {
      return payload.detail;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return "Unexpected error";
    }
  }

  return String(message);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: unknown) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message: formatToastMessage(message) }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  const success = useCallback((message: unknown) => addToast("success", message), [addToast]);
  const error = useCallback((message: unknown) => addToast("error", message), [addToast]);
  const info = useCallback((message: unknown) => addToast("info", message), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed right-4 top-[calc(env(safe-area-inset-top)+5rem)] z-[100000] flex flex-col gap-2 pointer-events-none lg:right-6 lg:top-[calc(env(safe-area-inset-top)+5.5rem)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[300px] max-w-md rounded-lg border p-4 shadow-lg animate-slide-in-right ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === "success" ? (
                  <FiCheckCircle className="h-5 w-5" />
                ) : toast.type === "error" ? (
                  <FiAlertCircle className="h-5 w-5" />
                ) : (
                  <FiInfo className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 text-sm font-medium">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
