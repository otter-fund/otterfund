"use client";

// In-page locked state for a routed page a user's plan doesn't include (the
// Insights + Investments routes). Deep-linkable and calm: the page still loads,
// but instead of the real content it shows this on-brand upsell panel whose CTA
// sends the user to the pricing page. The hard enforcement lives in the
// resolvers — this is the friendly front door.
//
// Built from the brand's signature language — a guilloché-textured header in
// the active accent, a Newsreader display title, the otter mark, accent-tint
// chips — so it reads like the rest of otterfund rather than a generic card.

import { ArrowRight, Check, Lock } from "lucide-react";
import { Card } from "@/components/otterfund/card";
import { OtterFace } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { Button } from "@/components/ui/button";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import { FEATURE_COPY, FEATURE_REQUIRED_TIER, PLAN_META, type Feature } from "@/lib/plans";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };

export function LockedFeature({ feature }: { feature: Feature }) {
  const { theme, promptUpgrade } = useOtterfundChrome();
  const copy = FEATURE_COPY[feature];
  const tier = FEATURE_REQUIRED_TIER[feature];

  return (
    <div className="of-enter mx-auto w-full max-w-[540px] pt-8 sm:pt-14">
      <Card className="overflow-hidden p-0">
        {/* ── Header — accent-tint field with a faint drifting guilloché, the
             brand's banknote texture. The otter mark sits on a raised surface
             chip; the title is set in Newsreader like every display heading. ── */}
        <div
          className="relative overflow-hidden px-8 pt-9 pb-8 text-center sm:px-12"
          style={{ background: `linear-gradient(180deg, ${theme.accentTint}, transparent)` }}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <GuillocheFlow accent={theme.accent} accentDeep={theme.accentDeep} opacity={0.08} fade="radial" speed={3} />
          </div>
          <div className="relative">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px]"
              style={{
                background: "var(--color-of-surface)",
                border: `1px solid ${theme.accentTintBorder}`,
                color: theme.accentDeep,
                boxShadow: "0 6px 18px oklch(20% 0.02 80 / 0.08)",
              }}
            >
              <OtterFace size={34} />
            </div>
            <span
              className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: "var(--color-of-surface)", color: theme.accentDeep, border: `1px solid ${theme.accentTintBorder}` }}
            >
              <Lock className="h-3 w-3" strokeWidth={2.4} />
              {PLAN_META[tier].name} feature
            </span>
            <h2
              className="mt-4 text-[30px] leading-[1.08] tracking-[-0.02em] text-[var(--color-of-ink)]"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              {copy.title}
            </h2>
            <p className="mx-auto mt-2.5 max-w-[360px] text-[14px] leading-relaxed text-[var(--color-of-muted)]">
              {copy.blurb}
            </p>
          </div>
        </div>

        {/* ── Perks + CTA on the warm surface. ── */}
        <div className="px-8 pb-9 pt-7 sm:px-12">
          <ul className="mx-auto flex max-w-[320px] flex-col gap-3">
            {copy.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5">
                <span
                  className="mt-[1px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: theme.accentTint, color: theme.accentDeep }}
                >
                  <Check className="h-3 w-3" strokeWidth={2.6} />
                </span>
                <span className="text-[13.5px] leading-snug text-[var(--color-of-ink)]">{perk}</span>
              </li>
            ))}
          </ul>

          <Button
            size="lg"
            onClick={promptUpgrade}
            className="mt-7 w-full font-semibold"
            style={{ background: theme.accent }}
          >
            Upgrade plan <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-3 text-center text-[11.5px] text-[var(--color-of-faint)]">
            Cancel anytime ·{" "}
            <Wordmark />
          </p>
        </div>
      </Card>
    </div>
  );
}
