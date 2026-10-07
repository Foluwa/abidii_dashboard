import { useEffect } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.css';
import Label from './Label';
import { CalenderIcon } from '../../icons';
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  minDate?: DateOption;
  dateFormat?: string;
  label?: string;
  placeholder?: string;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  minDate,
  dateFormat,
  placeholder,
}: PropsType) {
  useEffect(() => {
    const isTimeMode = mode === "time";

    const flatPickr = flatpickr(`#${id}`, isTimeMode
      ? {
          enableTime: true,
          noCalendar: true,
          dateFormat: dateFormat ?? "H:i",
          time_24hr: true,
          defaultDate,
          onChange,
        }
      : {
          mode: mode || "single",
          static: true,
          monthSelectorType: "static",
          dateFormat: dateFormat ?? "Y-m-d",
          defaultDate,
          minDate,
          onChange,
        });

    return () => {
      if (!Array.isArray(flatPickr)) {
        flatPickr.destroy();
      }
    };
  }, [mode, onChange, id, defaultDate, minDate, dateFormat]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-3 dark:bg-gray-900 text-foreground bg-transparent border-input focus:border-brand-300 focus:ring-brand-500/20 dark:focus:border-brand-800"
        />

        <span className="absolute text-muted-foreground -translate-y-1/2 pointer-events-none right-3 top-1/2">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
