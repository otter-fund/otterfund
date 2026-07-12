// Small accent-tinted glyph shown beside a plan label: a star for Standard, a
// party-popper for Pro, nothing for Free. Shared by the profile menu and the
// mobile nav footer so the two stay in sync.

import { PartyPopper, Star } from "lucide-react";

export function PlanBadgeIcon({ plan, size = 12 }: { plan: string; size?: number }) {
  const style = { color: "var(--color-primary)" } as const;
  if (plan === "pro") return <PartyPopper size={size} style={style} aria-hidden="true" />;
  if (plan === "standard") return <Star size={size} style={style} aria-hidden="true" />;
  return null;
}
