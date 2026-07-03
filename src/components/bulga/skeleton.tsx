// Loading-state placeholders for the route-level loading.tsx files. Pure
// server-safe markup built on the .bk-skel shimmer block — each mirrors the
// page scaffold it stands in for, so the content swap is calm.

import { cn } from "@/lib/utils";
import { Card } from "./card";

export function Skel({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("bk-skel", className)} style={style} aria-hidden="true" />;
}

/** Page root: keeps the bk-page column and announces loading to AT. */
export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bk-page" role="status" aria-label="Loading page">
      {children}
    </div>
  );
}

/**
 * Hero band — eyebrow, display figure, optional sub-line, and on the right
 * either action-button pills or a sparkline block (the overview).
 */
export function SkelHero({
  sub = false,
  actions = 0,
  chart = false,
}: {
  sub?: boolean;
  actions?: number;
  chart?: boolean;
}) {
  return (
    <section className="bk-hero-row flex items-end justify-between gap-7 px-1 pb-8">
      <div>
        <Skel className="h-3 w-36 rounded-md" />
        <Skel className="mt-3.5 h-[52px] w-64 rounded-2xl" />
        {sub && <Skel className="mt-3 h-3.5 w-52 rounded-md" />}
      </div>
      {chart && <Skel className="hidden h-[110px] w-full max-w-[360px] rounded-2xl sm:block" />}
      {actions > 0 && (
        <div className="flex shrink-0 gap-2.5 self-start">
          {Array.from({ length: actions }, (_, i) => (
            <Skel key={i} className="h-9 w-32 rounded-full" />
          ))}
        </div>
      )}
    </section>
  );
}

/** Card header: title left, hint/link right. */
export function SkelCardHeader() {
  return (
    <div className="mb-5 flex items-baseline justify-between">
      <Skel className="h-4 w-32 rounded-md" />
      <Skel className="h-3 w-24 rounded-md" />
    </div>
  );
}

/** Label + amount line over a slim progress bar ("Where it went", buckets). */
export function SkelBarList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <div className="mb-2 flex items-center justify-between">
            <Skel className="h-3.5 w-24 rounded-md" />
            <Skel className="h-3.5 w-14 rounded-md" />
          </div>
          <Skel className="h-[7px] w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Avatar tile + name/sub-line + right amount (activity, services, accounts). */
export function SkelAvatarRows({ rows = 5, divided = true }: { rows?: number; divided?: boolean }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 py-3",
            divided && i > 0 && "border-t border-[var(--color-bk-line-soft)]"
          )}
        >
          <Skel className="h-9 w-9 shrink-0 rounded-[11px]" />
          <div className="min-w-0 flex-1">
            <Skel className="h-3.5 w-2/5 rounded-md" />
            <Skel className="mt-1.5 h-3 w-1/4 rounded-md" />
          </div>
          <Skel className="h-3.5 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Surface card with the standard header + a body. */
export function SkelCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-6", className)}>
      <SkelCardHeader />
      {children}
    </Card>
  );
}
