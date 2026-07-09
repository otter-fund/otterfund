import { SkeletonPage, SkelHero, SkelCard, SkelBarList } from "@/components/otterfund/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero sub />
      <section className="of-grid-2up grid grid-cols-2 gap-4">
        <SkelCard>
          <SkelBarList rows={4} />
        </SkelCard>
        <SkelCard>
          <SkelBarList rows={4} />
        </SkelCard>
      </section>
    </SkeletonPage>
  );
}
