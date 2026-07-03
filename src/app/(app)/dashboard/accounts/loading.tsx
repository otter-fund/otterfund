import { SkeletonPage, Skel, SkelHero, SkelAvatarRows } from "@/components/bulga/skeleton";

// Accounts: net-worth hero + Connect/Add actions, then grouped account lists
// (group label + subtotal above a card of account rows).
export default function Loading() {
  return (
    <SkeletonPage>
      <SkelHero actions={2} />
      {[3, 2].map((rows, i) => (
        <div key={i} className="mb-6">
          <div className="flex items-baseline justify-between px-1 pb-3">
            <Skel className="h-3 w-28 rounded-md" />
            <Skel className="h-3.5 w-20 rounded-md" />
          </div>
          <div className="rounded-[20px] border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-6 py-1.5">
            <SkelAvatarRows rows={rows} />
          </div>
        </div>
      ))}
    </SkeletonPage>
  );
}
