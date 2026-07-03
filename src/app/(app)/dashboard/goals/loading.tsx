import { Card } from "@/components/bulga/card";
import { SkeletonPage, Skel, SkelHero } from "@/components/bulga/skeleton";

// Goals: saved-across-goals hero + Assign/New actions, then the 2-up goal
// cards (emoji tile + name + progress bar + funding figures).
export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero sub actions={2} />
      <section className="bk-grid-2up grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center gap-3">
              <Skel className="h-11 w-11 shrink-0 rounded-[13px]" />
              <div className="min-w-0 flex-1">
                <Skel className="h-4 w-1/2 rounded-md" />
                <Skel className="mt-2 h-3 w-1/3 rounded-md" />
              </div>
              <Skel className="h-6 w-16 rounded-full" />
            </div>
            <Skel className="mt-5 h-[7px] w-full rounded-full" />
            <div className="mt-4 flex items-center justify-between">
              <Skel className="h-3.5 w-24 rounded-md" />
              <Skel className="h-3.5 w-20 rounded-md" />
            </div>
          </Card>
        ))}
      </section>
    </SkeletonPage>
  );
}
