"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fromSelectValue, toSelectValue } from "./selectValue";
import { useTabActivity } from "@/components/ui/tab-activity";

export interface ComboboxProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
  searchPlaceholder?: string;
  fullWidth?: boolean;
  value: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  required?: boolean;
  /** Accessible name when there is no visible `label` prop. */
  "aria-label"?: string;
}

const REQUIRED_MESSAGE = "Please select an option.";

/**
 * Searchable single-select for long lists (voices, courses). Same value
 * contract as StyledSelect. Follows the ARIA combobox pattern: focus stays
 * in the search box, Arrow keys move the active option (announced via
 * aria-activedescendant), Enter selects, Escape closes and returns focus to
 * the trigger. The menu renders above dialogs and drawers.
 */
export const Combobox = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  ComboboxProps
>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder = "Select...",
      searchPlaceholder = "Search...",
      fullWidth = false,
      value,
      onChange,
      onValueChange,
      disabled = false,
      className = "",
      id,
      required,
      "aria-label": ariaLabel,
    },
    _ref,
  ) => {
    const autoId = React.useId();
    const triggerId = id ?? `combobox-${autoId}`;
    const listId = `${triggerId}-list`;
    const messageId = `${triggerId}-message`;

    const [open, setOpenState] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [active, setActive] = React.useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);

    const setOpen = (next: boolean) => {
      setOpenState(next);
      if (!next) setQuery("");
    };

    // Close the popover when the enclosing tab becomes inactive (the menu
    // renders through a portal outside the `hidden` panel). Adjusted during
    // render, not in an effect, per react-hooks/set-state-in-effect.
    const isActive = useTabActivity();
    const [prevActive, setPrevActive] = React.useState(isActive);
    if (isActive !== prevActive) {
      setPrevActive(isActive);
      if (!isActive) {
        setOpenState(false);
        setQuery("");
      }
    }

    const isEmpty = value === undefined || value === null || String(value) === "";
    const currentValue = toSelectValue(value);
    const selectedLabel = React.useMemo(
      () =>
        options.find((o) => toSelectValue(o.value) === currentValue)?.label ?? null,
      [options, currentValue],
    );

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return options;
      return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);

    // Keep the active option in range as the filter changes.
    const [prevQuery, setPrevQuery] = React.useState(query);
    if (query !== prevQuery) {
      setPrevQuery(query);
      setActive(0);
    }

    const [requiredError, setRequiredError] = React.useState(false);
    const [prevValue, setPrevValue] = React.useState(value);
    if (value !== prevValue) {
      setPrevValue(value);
      if (requiredError && !isEmpty) setRequiredError(false);
    }

    const handleSelect = (raw: string) => {
      const nextValue = fromSelectValue(raw);
      onValueChange?.(nextValue);
      onChange?.({
        target: { value: nextValue },
      } as unknown as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      triggerRef.current?.focus();
    };

    const moveActive = (delta: number) => {
      if (filtered.length === 0) return;
      let next = active;
      for (let i = 0; i < filtered.length; i++) {
        next = (next + delta + filtered.length) % filtered.length;
        if (!filtered[next].disabled) break;
      }
      setActive(next);
      document
        .getElementById(`${listId}-opt-${next}`)
        ?.scrollIntoView?.({ block: "nearest" });
    };

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = filtered[active];
        if (opt && !opt.disabled) handleSelect(toSelectValue(opt.value));
      }
    };

    const message = error ?? (requiredError ? REQUIRED_MESSAGE : undefined);
    const invalid = !!message;

    return (
      <div className={cn("relative", fullWidth && "w-full", className)}>
        {label && (
          <label htmlFor={triggerId} className="mb-2 block text-sm font-medium text-foreground">
            {label}
            {required && (
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild disabled={disabled}>
            <button
              ref={triggerRef}
              id={triggerId}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls={open ? listId : undefined}
              aria-invalid={invalid}
              aria-required={required || undefined}
              aria-label={label ? undefined : ariaLabel}
              aria-describedby={message || helperText ? messageId : undefined}
              className={cn(
                "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
                "dark:bg-input/30 dark:hover:bg-input/50",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                invalid ? "border-destructive ring-destructive/20" : "border-input",
              )}
            >
              <span className={cn("truncate", selectedLabel == null && "text-muted-foreground")}>
                {selectedLabel ?? placeholder}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
            </button>
          </PopoverPrimitive.Trigger>

          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              collisionPadding={8}
              className="z-[100000] w-[var(--radix-popover-trigger-width)] min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                searchInputRef.current?.focus();
              }}
            >
              <div className="flex items-center gap-2 border-b px-2 pb-1.5 pt-0.5">
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={
                    filtered.length ? `${listId}-opt-${active}` : undefined
                  }
                  className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div
                id={listId}
                role="listbox"
                aria-label={label ?? placeholder}
                className="max-h-64 overflow-y-auto p-1"
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No results
                  </div>
                ) : (
                  filtered.map((option, index) => {
                    const optionValue = toSelectValue(option.value);
                    const isSelected = optionValue === currentValue;
                    return (
                      <div
                        id={`${listId}-opt-${index}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled || undefined}
                        data-value={String(option.value)}
                        data-active={index === active || undefined}
                        key={optionValue}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => !option.disabled && handleSelect(optionValue)}
                        className={cn(
                          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none",
                          "data-[active]:bg-accent data-[active]:text-accent-foreground",
                          option.disabled && "pointer-events-none opacity-50",
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        {isSelected && <CheckIcon className="absolute right-2 size-4" />}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        {required && (
          <select
            aria-hidden="true"
            tabIndex={-1}
            required
            disabled={disabled}
            value={isEmpty ? "" : String(value)}
            onChange={() => {}}
            onInvalid={(e) => {
              e.preventDefault();
              setRequiredError(true);
              triggerRef.current?.focus();
            }}
            onFocus={(e) => {
              e.preventDefault();
              triggerRef.current?.focus();
            }}
            className="pointer-events-none absolute bottom-0 left-0 size-px overflow-hidden opacity-0"
          >
            <option value="" />
            {options
              .filter((o) => String(o.value) !== "")
              .map((option) => (
                <option key={String(option.value)} value={String(option.value)} />
              ))}
          </select>
        )}

        {message ? (
          <p id={messageId} role="alert" className="mt-1.5 text-sm text-destructive">
            {message}
          </p>
        ) : helperText ? (
          <p id={messageId} className="mt-1.5 text-sm text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Combobox.displayName = "Combobox";
