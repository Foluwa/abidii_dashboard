"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue } from "./selectValue";
import { useTabActivity } from "@/components/ui/tab-activity";

export interface StyledSelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "onChange" | "value"
  > {
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

const REQUIRED_MESSAGE = "Please select an option.";

/**
 * Single-select dropdown rendered by Radix (never the browser's native
 * menu), with the dashboard's controlled `value`/`onChange` contract.
 *
 * - `value=""` is a real option ("All") when one exists; otherwise it means
 *   "nothing selected" and the placeholder shows.
 * - `required` is enforced by a visually hidden native <select> mirroring the
 *   value. It is never shown, has no name (no duplicate form value) and is
 *   out of the tab order; on an invalid submission it forwards focus to the
 *   visible trigger, which is marked aria-invalid with an announced message.
 */
export const StyledSelect = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  StyledSelectProps
>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      fullWidth = false,
      value,
      onChange,
      onValueChange,
      disabled = false,
      className = "",
      id,
      name,
      required,
      ...rest
    },
    _ref,
  ) => {
    const autoId = React.useId();
    const triggerId = id ?? `select-${autoId}`;
    const messageId = `${triggerId}-message`;

    // Forward data-* / aria-* attributes (e.g. data-field-path used by
    // validation scroll-to/highlight) onto the trigger. Other native
    // <select> attributes are intentionally dropped.
    const passthroughAttrs = React.useMemo(
      () =>
        Object.fromEntries(
          Object.entries(rest).filter(
            ([key]) => key.startsWith("data-") || key.startsWith("aria-"),
          ),
        ),
      [rest],
    );

    if (process.env.NODE_ENV !== "production") {
      for (const o of options) {
        if (String(o.value) === EMPTY_SELECT_VALUE) {
          // The sentinel stands in for value="" - a real option with this
          // exact value would be indistinguishable from "All".
          console.error(`StyledSelect: option value collides with ${EMPTY_SELECT_VALUE}`);
        }
      }
    }

    const hasEmptyOption = options.some((o) => String(o.value) === "");
    const isEmpty = value === undefined || value === null || String(value) === "";
    // Radix shows the placeholder only for value "" - use it when "" is not
    // itself a selectable option.
    const radixValue = isEmpty && !hasEmptyOption ? "" : toSelectValue(value);

    const [requiredError, setRequiredError] = React.useState(false);
    const [prevValue, setPrevValue] = React.useState(value);
    if (value !== prevValue) {
      setPrevValue(value);
      if (requiredError && !isEmpty) setRequiredError(false);
    }

    const handleValueChange = (raw: string) => {
      // Only real options may change the value. Radix's hidden form-sync
      // <select> can emit "" when the controlled value and the option list
      // change in the same render (e.g. options loaded async), which would
      // otherwise silently clear the caller's state.
      if (!options.some((o) => toSelectValue(o.value) === raw)) return;
      const nextValue = fromSelectValue(raw);
      onValueChange?.(nextValue);
      onChange?.({
        target: { value: nextValue },
      } as unknown as React.ChangeEvent<HTMLSelectElement>);
    };

    const triggerRef = React.useRef<HTMLButtonElement>(null);

    // Close the menu when the enclosing tab becomes inactive (the menu renders
    // through a portal outside the `hidden` panel). Adjusted during render, not
    // in an effect, per this codebase's react-hooks/set-state-in-effect rule.
    const isActive = useTabActivity();
    const [open, setOpen] = React.useState(false);
    const [prevActive, setPrevActive] = React.useState(isActive);
    if (isActive !== prevActive) {
      setPrevActive(isActive);
      if (!isActive) setOpen(false);
    }

    const message = error ?? (requiredError ? REQUIRED_MESSAGE : undefined);
    const invalid = !!message;

    return (
      <div className={cn("relative", fullWidth && "w-full", className)}>
        {label && (
          <label
            htmlFor={triggerId}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {label}
            {required && (
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <SelectPrimitive.Root
          value={radixValue}
          onValueChange={handleValueChange}
          disabled={disabled}
          name={name}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectPrimitive.Trigger
            ref={triggerRef}
            id={triggerId}
            aria-invalid={invalid}
            aria-required={required || undefined}
            aria-describedby={message || helperText ? messageId : undefined}
            {...passthroughAttrs}
            className={cn(
              "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
              "dark:bg-input/30 dark:hover:bg-input/50",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "[&>span]:truncate data-[placeholder]:text-muted-foreground",
              invalid
                ? "border-destructive ring-destructive/20 dark:ring-destructive/40"
                : "border-input",
            )}
          >
            <SelectPrimitive.Value placeholder={placeholder ?? "Select..."} />
            <SelectPrimitive.Icon asChild>
              <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              collisionPadding={8}
              className="relative z-[100000] max-h-[min(var(--radix-select-content-available-height),18rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                <ChevronDownIcon className="size-4 rotate-180" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={toSelectValue(option.value)}
                    value={toSelectValue(option.value)}
                    data-value={String(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                    )}
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
                      <CheckIcon className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                <ChevronDownIcon className="size-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {required && (
          <select
            aria-hidden="true"
            tabIndex={-1}
            required
            disabled={disabled}
            value={isEmpty ? "" : String(value)}
            onChange={() => {}}
            onInvalid={(e) => {
              // Block the browser's own bubble on this hidden control and
              // show the error on the visible trigger instead.
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

StyledSelect.displayName = "StyledSelect";
