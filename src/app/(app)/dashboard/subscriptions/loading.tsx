import { SkeletonPage, SkelHero, SkelCard, SkelAvatarRows, SkelBarList } from "@/components/bulga/skeleton";

// Subscriptions: monthly-total hero + "New subscription" action, then the
// Services list and annual-projection cards side by side.
export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero sub actions={1} />
      <section className="bk-grid-2up grid grid-cols-2 gap-4">
        <SkelCard>
          <SkelAvatarRows rows={5} />
        </SkelCard>
        <SkelCard>
          <SkelBarList rows={4} />
        </SkelCard>
      </section>
    </SkeletonPage>
  );
}
