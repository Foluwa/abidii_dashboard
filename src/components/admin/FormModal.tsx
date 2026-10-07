/**
 * Form Modal Component
 * Modal specifically for forms with save/cancel actions
 */

import React from 'react';
import Modal from './Modal';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  children: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  isSubmitting?: boolean;
  submitDisabled?: boolean;
}

export default function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  size = 'md',
  isSubmitting = false,
  submitDisabled = false,
}: FormModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size} closeOnOutsideClick={!isSubmitting}>
      <form onSubmit={handleSubmit}>
        {/* Form Content */}
        <div className="space-y-4">
          {children}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || submitDisabled}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-brand-600 border border-transparent rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
