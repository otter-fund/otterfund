// otterfund surface card — the calm, flat replacement for the old GlassCard.
// A warm-white surface, hairline border, soft corners. No glassmorphism.

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Subtle lift on hover (off by default — most cards are static). */
  hover?: boolean;
}

export function Card({ className, hover = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)]",
        hover &&
          "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-[3px] hover:shadow-[0_12px_32px_oklch(20%_0.02_80/0.08)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Uppercase eyebrow label — section headers, stat labels. */
export function CardLabel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[12px] font-semibold tracking-[0.07em] uppercase text-[var(--color-of-faint)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
