import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LOGO_CORAL } from "@/components/otterfund/theme";
import { Wordmark } from "@/components/otterfund/wordmark";
import { buttonVariants } from "@/components/ui/button";
// Reuse the maintenance illustration (two beavers on a raft + an otter holding
// a "?") — the questioning otter is a natural fit for a 404. Recolored coral by
// using it as a CSS mask over a solid block, the same way <LogoMark> recolors
// the otter mark.
import maintenanceMark from "./maintenance/maintenance-mark.svg";

const MARK_MASK = `url(${maintenanceMark.src}) center / contain no-repeat`;

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

// The 404 screen. Same calm, on-brand language as the maintenance page: warm
// canvas + paper grain, the coral illustration, Newsreader display type, and a
// pill button back to safe ground.
export default function NotFound() {
  return (
    <main className="of-paper relative flex min-h-screen flex-col items-center justify-center bg-[var(--color-of-canvas)] px-6 py-16">
      <div className="of-enter w-full max-w-[440px] text-center">
        <div className="flex justify-center">
          <div
            aria-hidden
            style={{
              width: "min(300px, 78vw)",
              aspectRatio: "1519 / 790",
              backgroundColor: LOGO_CORAL,
              WebkitMask: MARK_MASK,
              mask: MARK_MASK,
            }}
          />
        </div>

        <p className="of-num mt-8 text-[15px] font-medium uppercase tracking-[0.24em] text-[var(--color-of-faint)]">
          Error 404
        </p>
        <h1 className="of-num mt-3 text-balance text-[34px] font-medium leading-[1.08] tracking-[-0.02em] text-[var(--color-of-ink)]">
          This page swam off
        </h1>
        <p className="mx-auto mt-4 max-w-[320px] text-balance text-[15px] leading-relaxed text-[var(--color-of-muted)]">
          We couldn&apos;t fish out that page. It may have moved, or it never
          existed. Let&apos;s get you back to dry land.
        </p>

        <div className="mt-10">
          <Link href="/" className={buttonVariants({ className: "font-semibold" })}>
            <ArrowLeft className="h-4 w-4" />
            Back to shore
          </Link>
        </div>
      </div>

      <footer className="of-enter mt-16 text-[12px] text-[var(--color-of-faint)]">
        © {new Date().getFullYear()} <Wordmark />
      </footer>
    </main>
  );
}
