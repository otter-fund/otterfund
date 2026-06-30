"use client";

// Bulga tabs — vertical/horizontal tab rail. The active tab is a solid
// dark-accent pill, matching the app's icon-rail (RailLink in bulga-chrome).

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** The live accent — fills the active tab. */
  accent: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export function Tabs({
  items,
  value,
  onValueChange,
  accent,
  orientation = "vertical",
  className,
}: TabsProps) {
  const vertical = orientation === "vertical";
  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      className={cn("flex gap-1", vertical ? "flex-col" : "flex-row", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "group flex items-center gap-2.5 rounded-full px-4 py-2.5 text-left text-[13.5px] font-medium",
              "transition-[background-color,color] duration-200 ease-[cubic-bezier(.22,.61,.36,1)]",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              vertical ? "w-full" : "shrink-0",
              active
                ? "text-white"
                : "text-[var(--color-bk-muted)] hover:bg-[var(--color-bk-line-soft)] hover:text-[var(--color-bk-ink)]"
            )}
            style={active ? { background: accent } : undefined}
          >
            {Icon && (
              <Icon
                className="h-[16px] w-[16px] shrink-0"
                strokeWidth={active ? 2.1 : 1.9}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
