import { SkeletonPage, SkelHero, SkelCard, SkelAvatarRows, SkelBarList } from "@/components/otterfund/skeleton";

// Investments: portfolio-value hero + "New investment" action, then allocation
// beside the holdings list, and the by-account + performance cards below.
export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero sub actions={1} />
      <section className="of-grid-2up grid grid-cols-2 gap-4">
        <SkelCard>
          <SkelBarList rows={5} />
        </SkelCard>
        <SkelCard>
          <SkelAvatarRows rows={5} />
        </SkelCard>
      </section>
      <section className="of-grid-2up mt-4 grid grid-cols-2 gap-4">
        <SkelCard>
          <SkelBarList rows={3} />
        </SkelCard>
        <SkelCard>
          <SkelBarList rows={4} />
        </SkelCard>
      </section>
    </SkeletonPage>
  );
}
