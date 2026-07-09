import { Skel } from "@/components/otterfund/skeleton";

// Insights page: a single top bar (New chat + centered toggle, no divider) above
// a full-screen chat workspace (sidebar + thread), with a continuous side line.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="of-fullbleed flex flex-col"
      style={{ background: "var(--color-of-surface)" }}
    >
      {/* top bar */}
      <div className="relative flex h-14 shrink-0 items-center">
        <div className="flex h-full w-[248px] shrink-0 items-center gap-2 border-r border-[var(--color-of-line-soft)] px-3">
          <Skel className="h-8 w-8 rounded-full" />
          <Skel className="h-9 w-28 rounded-full" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Skel className="h-[46px] w-[262px] rounded-full" />
        </div>
      </div>

      {/* workspace */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[248px] shrink-0 flex-col gap-2 border-r border-[var(--color-of-line-soft)] p-3 md:flex">
          {Array.from({ length: 8 }, (_, i) => (
            <Skel key={i} className="h-11 w-full rounded-[10px]" />
          ))}
        </aside>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-end gap-5 p-6">
            <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
              <Skel className="h-12 w-3/5 self-end rounded-2xl" />
              <Skel className="h-28 w-full rounded-2xl" />
              <Skel className="h-12 w-2/5 self-end rounded-2xl" />
            </div>
          </div>
          <div className="border-t border-[var(--color-of-line-soft)] p-5">
            <Skel className="mx-auto h-14 w-full max-w-[720px] rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
