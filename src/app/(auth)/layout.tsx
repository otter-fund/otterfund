import Link from "next/link";
import { LogoMark } from "@/components/bulga/logo";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

// Split-screen auth shell. An immersive banknote brand panel on the left
// (lg+ only) carries the pitch; the form column on the right stays calm and
// unadorned. Below lg the panel drops away and the form column stands alone
// with a compact brand header.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[var(--color-bk-canvas)] lg:grid lg:grid-cols-[1.02fr_1fr] xl:grid-cols-[1.08fr_1fr]">
      <AuthBrandPanel />

      <main className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10">
        {/* compact brand header — the panel owns branding on lg+, so this only
            shows when the panel is hidden */}
        <div className="lg:hidden">
          <Link href="/" aria-label="Bulga home" className="inline-flex items-center">
            <LogoMark size={38} />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        <footer className="flex items-center justify-center gap-4 text-[12px] text-[var(--color-bk-faint)]">
          <span>© {new Date().getFullYear()} Bulga</span>
          <span aria-hidden>·</span>
          <Link href="/" className="transition-colors hover:text-[var(--color-bk-muted)]">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/" className="transition-colors hover:text-[var(--color-bk-muted)]">
            Terms
          </Link>
        </footer>
      </main>
    </div>
  );
}
