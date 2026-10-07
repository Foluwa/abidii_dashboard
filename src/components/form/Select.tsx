"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fromSelectValue, toSelectValue } from "@/components/ui/form/selectValue";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  defaultValue = "",
}) => {
  const [selectedValue, setSelectedValue] = React.useState<string>(defaultValue);

  const handleValueChange = (raw: string) => {
    const value = fromSelectValue(raw);
    setSelectedValue(value);
    onChange(value);
  };

  return (
    <SelectPrimitive.Root
      value={toSelectValue(selectedValue)}
      onValueChange={handleValueChange}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "h-11 w-full appearance-none items-center justify-between gap-2 rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm shadow-theme-xs",
          "focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10",
          "dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800",
          "data-[placeholder]:text-gray-400 dark:data-[placeholder]:text-gray-400",
          selectedValue
            ? "text-foreground"
            : "text-muted-foreground",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={toSelectValue(option.value)}
                value={toSelectValue(option.value)}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-md py-2 pl-3 pr-8 text-sm text-gray-900 outline-none",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  "data-[highlighted]:bg-gray-100 dark:text-gray-100 dark:data-[highlighted]:bg-gray-800",
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
                  <CheckIcon className="size-4 text-brand-600 dark:text-brand-400" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};

export default Select;
