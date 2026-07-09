"use client";

// Shared reading layout for the Privacy Policy and Terms of Service. On-brand:
// warm canvas, Newsreader title, Hanken body, slim otterfund chrome. Prose
// styling is applied via descendant selectors on the <article> wrapper so the
// content pages stay clean semantic HTML (h2/h3/p/ul/a/strong).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/otterfund/logo";
import { LEGAL } from "@/lib/legal";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };

const PROSE = [
  "[&_h2]:mt-12 [&_h2]:mb-1 [&_h2]:scroll-mt-24 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-[var(--color-of-ink)]",
  "[&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:text-[15.5px] [&_h3]:font-semibold [&_h3]:text-[var(--color-of-ink)]",
  "[&_p]:mt-3 [&_p]:text-[14.5px] [&_p]:leading-[1.7] [&_p]:text-[var(--color-of-muted)]",
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
  "[&_li]:pl-1 [&_li]:text-[14.5px] [&_li]:leading-[1.7] [&_li]:text-[var(--color-of-muted)]",
  "[&_a]:font-medium [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-semibold [&_strong]:text-[var(--color-of-ink)]",
].join(" ");

export function LegalShell({
  title,
  docType,
  children,
}: {
  title: string;
  docType: "privacy" | "terms";
  children: React.ReactNode;
}) {
  const other =
    docType === "privacy"
      ? { href: "/terms", label: "Terms of Service" }
      : { href: "/privacy", label: "Privacy Policy" };

  return (
    <div className="of-paper min-h-screen bg-[var(--color-of-canvas)] text-[var(--color-of-ink)]">
      {/* top chrome */}
      <header className="border-b border-[var(--color-of-line-soft)]">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-6 py-4">
          <Link href="/" aria-label="otterfund home" className="inline-flex items-center">
            <LogoMark size={44} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-of-muted)] transition-colors hover:text-[var(--color-of-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 pb-24 pt-12 sm:pt-16">
        <div className="of-enter">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-of-faint)]">
            Legal
          </div>
          <h1
            className="mt-3 text-[clamp(30px,5vw,44px)] leading-[1.05] tracking-[-0.02em]"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            {title}
          </h1>
          <p className="mt-4 text-[13.5px] text-[var(--color-of-muted)]">
            Last updated {LEGAL.lastUpdated}
          </p>
        </div>

        <article className={`mt-8 ${PROSE}`}>{children}</article>

        {/* cross-link + contact footer */}
        <footer className="mt-16 flex flex-col gap-4 border-t border-[var(--color-of-line-soft)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-of-muted)]">
            <LogoMark size={16} />
            © {LEGAL.lastUpdated.split(" ").pop()} {LEGAL.service}
          </div>
          <nav className="flex items-center gap-5 text-[13px]" aria-label="Legal">
            <Link href={other.href} className="text-[var(--color-of-muted)] transition-colors hover:text-[var(--color-of-ink)]">
              {other.label}
            </Link>
            <a
              href={`mailto:${LEGAL.privacyEmail}`}
              className="text-[var(--color-of-muted)] transition-colors hover:text-[var(--color-of-ink)]"
            >
              Contact
            </a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
