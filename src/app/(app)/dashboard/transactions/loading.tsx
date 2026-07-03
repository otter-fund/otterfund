import { SkeletonPage, Skel } from "@/components/bulga/skeleton";

const TABLE_GRID = { display: "grid", gridTemplateColumns: "26px 2.4fr 1.3fr 1fr 1fr", gap: 16 } as const;

// Transactions: search + segment pills + account filter toolbar, then the
// table card (header row + checkbox/merchant/category/date/amount rows).
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Skel className="h-[42px] min-w-[200px] flex-1 rounded-[13px]" />
        <Skel className="h-[42px] w-60 rounded-full" />
        <Skel className="h-9 w-32 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-[20px] border border-[var(--color-bk-line-soft)] bg-[var(--color-bk-surface)]">
        <div className="border-b border-[var(--color-bk-line-soft)] px-6 py-[14px]" style={TABLE_GRID}>
          <Skel className="h-4 w-4 rounded-md" />
          <Skel className="h-3 w-20 rounded-md" />
          <Skel className="h-3 w-16 rounded-md" />
          <Skel className="h-3 w-12 rounded-md" />
          <Skel className="h-3 w-16 justify-self-end rounded-md" />
        </div>
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="items-center border-b border-[var(--color-bk-line-soft)] px-6 py-3 last:border-b-0"
            style={TABLE_GRID}
          >
            <Skel className="h-4 w-4 rounded-md" />
            <div className="flex items-center gap-3">
              <Skel className="h-9 w-9 shrink-0 rounded-[11px]" />
              <div className="min-w-0 flex-1">
                <Skel className="h-3.5 w-3/5 rounded-md" />
                <Skel className="mt-1.5 h-3 w-2/5 rounded-md" />
              </div>
            </div>
            <Skel className="h-6 w-20 rounded-full" />
            <Skel className="h-3.5 w-12 rounded-md" />
            <Skel className="h-3.5 w-16 justify-self-end rounded-md" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
