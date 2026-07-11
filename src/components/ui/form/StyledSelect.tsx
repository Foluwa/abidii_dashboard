"use client";
import React, { forwardRef } from "react";

export interface StyledSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
  fullWidth?: boolean;
  value: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
}

export const StyledSelect = forwardRef<HTMLSelectElement, StyledSelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder = "Select an option",
      fullWidth = false,
      className = "",
      disabled = false,
      onChange,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors appearance-none cursor-pointer";
    const normalClasses =
      "border-gray-300 dark:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 hover:border-gray-400 dark:hover:border-gray-500";
    const errorClasses =
      "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
    const disabledClasses =
      "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900";
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <div className={`${widthClass} ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={`
              ${baseClasses}
              ${error ? errorClasses : normalClasses}
              ${disabled ? disabledClasses : ""}
              ${widthClass}
              pr-10
            `}
            onChange={(e) => {
              onChange?.(e);
              onValueChange?.(e.target.value);
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400 dark:text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

StyledSelect.displayName = "StyledSelect";
