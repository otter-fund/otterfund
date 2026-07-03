import { Card } from "@/components/bulga/card";
import { SkeletonPage, Skel } from "@/components/bulga/skeleton";

// Insights: tinted AI-overview hero card with the Generate action, then the
// insight list (tag chip + body lines per row).
export default function Loading() {
  return (
    <SkeletonPage>
      <Card className="mb-4 px-7 py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skel className="h-3 w-24 rounded-md" />
            <Skel className="mt-4 h-4 w-4/5 rounded-md" />
            <Skel className="mt-2.5 h-4 w-3/5 rounded-md" />
          </div>
          <Skel className="h-9 w-40 shrink-0 rounded-full" />
        </div>
      </Card>
      <Card className="p-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={i > 0 ? "border-t border-[var(--color-bk-line-soft)] py-4" : "pb-4"}>
            <Skel className="h-5 w-20 rounded-full" />
            <Skel className="mt-3 h-3.5 w-full rounded-md" />
            <Skel className="mt-2 h-3.5 w-2/3 rounded-md" />
          </div>
        ))}
      </Card>
    </SkeletonPage>
  );
}
