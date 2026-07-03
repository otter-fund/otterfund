import { Card } from "@/components/bulga/card";
import { SkeletonPage, Skel, SkelHero, SkelCard, SkelBarList, SkelAvatarRows } from "@/components/bulga/skeleton";

// Overview: net-worth hero + sparkline · 3 stat cards · "Where it went" +
// "Goals on track" bar cards · "Recent activity" + insight split.
export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero chart />
      <section className="bk-grid-3 mb-4 grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="px-6 py-[22px]">
            <Skel className="h-3 w-16 rounded-md" />
            <Skel className="mt-2.5 h-[30px] w-32 rounded-lg" />
          </Card>
        ))}
      </section>
      <section className="bk-grid-2up mb-4 grid grid-cols-2 gap-4">
        <SkelCard>
          <SkelBarList rows={4} />
        </SkelCard>
        <SkelCard>
          <SkelBarList rows={4} />
        </SkelCard>
      </section>
      <section className="bk-grid-split grid grid-cols-[1.5fr_1fr] gap-4">
        <SkelCard>
          <SkelAvatarRows rows={5} />
        </SkelCard>
        <Card className="flex flex-col p-6">
          <Skel className="h-3 w-24 rounded-md" />
          <Skel className="mt-4 h-5 w-full rounded-md" />
          <Skel className="mt-2.5 h-5 w-4/5 rounded-md" />
          <Skel className="mt-2.5 h-5 w-3/5 rounded-md" />
          <div className="flex-1" />
          <Skel className="mt-5 h-9 w-40 self-start rounded-full" />
        </Card>
      </section>
    </SkeletonPage>
  );
}
