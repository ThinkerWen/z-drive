import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, options, onChange, placeholder = "请选择", className = "" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => options.find((item) => item.value === value), [options, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-white/90 px-3 py-2 text-left text-sm shadow-sm transition hover:border-primary/55"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={current ? "text-foreground" : "text-muted-foreground"}>{current ? current.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="theme-scrollbar absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border/80 bg-white/95 p-1.5 shadow-xl backdrop-blur">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={
                  selected
                    ? "mb-1 flex w-full items-start gap-2 rounded-lg bg-primary/10 px-2.5 py-2 text-left"
                    : "mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted/70"
                }
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                  {selected ? <Check className="h-4 w-4" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  {option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
