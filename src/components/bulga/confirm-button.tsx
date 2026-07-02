"use client";

// Destructive confirm button — an icon-only clay pill that expands to reveal a
// confirm label on first click, then fires on the second. Auto-disarms after a
// few seconds. One implementation for every destructive action (delete goal,
// disconnect account/bank, …) so the pattern and clay tone never drift.

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmButtonProps {
  /** Fired on the second (confirming) click. */
  onConfirm: () => void;
  /** Resting icon (e.g. Trash2, Unlink). */
  icon: LucideIcon;
  /** Icon shown while the action runs (defaults to the resting icon). */
  busyIcon?: LucideIcon;
  /** Confirm-state label, e.g. "Are you sure?". */
  confirmLabel: string;
  /** In-progress label, e.g. "Deleting…". */
  busyLabel: string;
  busy?: boolean;
  disabled?: boolean;
  /** Accessible labels for resting vs armed states. */
  restLabel: string;
  armedLabel: string;
  /** Collapsed (icon-only) and expanded widths. Matches the surrounding scale. */
  collapsedWidth?: string; // e.g. "w-10"
  expandedWidth?: string; // e.g. "w-[148px]"
  labelMaxWidth?: string; // e.g. "max-w-[140px]"
  className?: string;
}

const EASE = "ease-[cubic-bezier(0.25,0.46,0.45,0.94)]";

export function ConfirmButton({
  onConfirm,
  icon: Icon,
  busyIcon: BusyIcon,
  confirmLabel,
  busyLabel,
  busy = false,
  disabled = false,
  restLabel,
  armedLabel,
  collapsedWidth = "w-10",
  expandedWidth = "w-[148px]",
  labelMaxWidth = "max-w-[140px]",
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const RunIcon = busy && BusyIcon ? BusyIcon : Icon;

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      disabled={disabled || busy}
      aria-label={armed ? armedLabel : restLabel}
      aria-pressed={armed}
      className={cn(
        "h-10 rounded-full flex items-center justify-center shrink-0 min-w-0 cursor-pointer text-sm font-semibold text-white",
        "bg-[var(--color-bk-clay)] hover:opacity-90 transition-[width,padding,gap,opacity] duration-300 disabled:opacity-50",
        EASE,
        armed ? `${expandedWidth} gap-1.5 px-3` : `${collapsedWidth} gap-0 px-0`,
        className,
      )}
    >
      <RunIcon className={cn("w-4 h-4 shrink-0", busy && BusyIcon && "animate-spin")} />
      <span
        className={cn(
          "whitespace-nowrap overflow-hidden text-[13px] font-semibold transition-[max-width,opacity] duration-300",
          EASE,
          armed ? `${labelMaxWidth} opacity-100` : "max-w-0 opacity-0",
        )}
      >
        {busy ? busyLabel : confirmLabel}
      </span>
    </button>
  );
}
