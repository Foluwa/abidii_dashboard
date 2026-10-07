"use client";
import React, { useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountryCode {
  code: string;
  label: string;
}

interface PhoneInputProps {
  countries: CountryCode[];
  placeholder?: string;
  onChange?: (phoneNumber: string) => void;
  selectPosition?: "start" | "end";
}

function CountrySelect({
  countries,
  selectedCountry,
  onCountryChange,
  position,
}: {
  countries: CountryCode[];
  selectedCountry: string;
  onCountryChange: (code: string) => void;
  position: "start" | "end";
}) {
  return (
    <SelectPrimitive.Root value={selectedCountry} onValueChange={onCountryChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex items-center gap-1 rounded-none border-0 bg-transparent py-3 pl-3.5 pr-8 leading-tight text-gray-700 outline-none",
          "focus:ring-0",
          "dark:text-gray-400",
          position === "start"
            ? "rounded-l-lg border-r border-border"
            : "rounded-r-lg border-l border-border",
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <SelectPrimitive.Viewport className="p-1">
            {countries.map((country) => (
              <SelectPrimitive.Item
                key={country.code}
                value={country.code}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-md py-2 pl-3 pr-8 text-sm text-gray-900 outline-none",
                  "data-[highlighted]:bg-gray-100 dark:text-gray-100 dark:data-[highlighted]:bg-gray-800",
                )}
              >
                <SelectPrimitive.ItemText>
                  {country.code} {country.label}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  countries,
  placeholder = "+1 (555) 000-0000",
  onChange,
  selectPosition = "start",
}) => {
  const [selectedCountry, setSelectedCountry] = useState<string>("US");
  const [phoneNumber, setPhoneNumber] = useState<string>("+1");

  const countryCodes: Record<string, string> = countries.reduce(
    (acc, { code, label }) => ({ ...acc, [code]: label }),
    {}
  );

  const handleCountryChange = (newCountry: string) => {
    setSelectedCountry(newCountry);
    setPhoneNumber(countryCodes[newCountry]);
    onChange?.(countryCodes[newCountry]);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhoneNumber = e.target.value;
    setPhoneNumber(newPhoneNumber);
    onChange?.(newPhoneNumber);
  };

  return (
    <div className="relative flex">
      {selectPosition === "start" && (
        <div className="absolute">
          <CountrySelect
            countries={countries}
            selectedCountry={selectedCountry}
            onCountryChange={handleCountryChange}
            position="start"
          />
        </div>
      )}

      <input
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneNumberChange}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-gray-300 bg-transparent py-3 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400",
          "focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10",
          "dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800",
          selectPosition === "start" ? "pl-[84px]" : "pr-[84px]",
        )}
      />

      {selectPosition === "end" && (
        <div className="absolute right-0">
          <CountrySelect
            countries={countries}
            selectedCountry={selectedCountry}
            onCountryChange={handleCountryChange}
            position="end"
          />
        </div>
      )}
    </div>
  );
};

export default PhoneInput;
