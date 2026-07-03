import { Card } from "@/components/bulga/card";
import { SkeletonPage, Skel, SkelHero, SkelCard, SkelBarList } from "@/components/bulga/skeleton";

// Spending: spent-of-budget hero · "Plan vs. actual" dual-donut card ·
// "Bucket progress" bars · "Category breakdown" rows.
export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero />
      <Card className="mb-4 p-6">
        <div className="flex items-baseline justify-between">
          <Skel className="h-4 w-28 rounded-md" />
          <Skel className="h-3 w-20 rounded-md" />
        </div>
        <Skel className="mt-2.5 mb-6 h-3 w-3/5 rounded-md" />
        <div className="flex flex-wrap justify-center gap-8">
          <Skel className="h-[150px] w-[150px] rounded-full" />
          <Skel className="h-[150px] w-[150px] rounded-full" />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skel className="h-3.5 w-24 rounded-md" />
              <Skel className="h-3.5 w-36 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
      <div className="mb-4">
        <SkelCard>
          <SkelBarList rows={3} />
        </SkelCard>
      </div>
      <Card className="p-6">
        <Skel className="h-4 w-40 rounded-md" />
        {[0, 1, 2].map((g) => (
          <div key={g} className="mt-5">
            <div className="mb-1 flex items-center gap-2">
              <Skel className="h-[9px] w-[9px] rounded-full" />
              <Skel className="h-3 w-24 rounded-md" />
              <Skel className="ml-auto h-3 w-14 rounded-md" />
            </div>
            {[0, 1].map((r) => (
              <div key={r} className="flex items-center justify-between border-t border-[var(--color-bk-line-soft)] py-2.5">
                <div className="flex items-center gap-2.5">
                  <Skel className="h-[9px] w-[9px] rounded-full" />
                  <Skel className="h-3.5 w-28 rounded-md" />
                </div>
                <Skel className="h-3.5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ))}
      </Card>
    </SkeletonPage>
  );
}
