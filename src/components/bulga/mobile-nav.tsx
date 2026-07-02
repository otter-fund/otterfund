"use client";

// Bulga mobile navigation — a premium bottom sheet that replaces the icon rail
// below the desktop breakpoint. Built on Base UI's Dialog (focus trap, backdrop,
// Escape, scroll-lock, portal). The trigger is an animated hamburger (three
// lines morph to an X); the sheet slides up from the bottom edge with a grab
// handle, rounded top, tinted icon tiles, a soft active state, and a staggered
// row reveal. Desktop keeps the icon rail — this whole control is display:none
// there (see .bk-hamburger / .bk-rail in globals.css).

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

// Must match the .bk-hamburger / .bk-rail breakpoint in globals.css: above this
// the hamburger is hidden and the icon rail takes over.
const DESKTOP_QUERY = "(min-width: 769px)";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export function MobileNav({
  primary,
  secondary,
  pathname,
  hrefFor,
  accent,
  userName,
  initials,
  onOpenSettings,
  onSignOut,
}: {
  primary: NavItem[];
  secondary: NavItem[];
  pathname: string;
  hrefFor: (href: string) => string;
  accent: string;
  userName: string | null;
  initials: string | null;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  // Controlled so we can force-close when the viewport grows past the desktop
  // breakpoint: there the hamburger is hidden and the icon rail takes over, so a
  // still-open sheet would orphan over the desktop layout with nothing that
  // opened it. Base UI's open state is JS, not CSS, so it can't react to the
  // breakpoint on its own — we watch matchMedia and close on the desktop side.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const close = () => { if (mq.matches) setOpen(false); };
    close(); // handle a load that starts already-desktop
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  // Each row is a Dialog.Close rendering a Link, so a tap navigates and dismisses
  // in one gesture. --i drives the staggered entrance. Quiet by default: an
  // inline icon + label, no tile. The active row is the only emphasis — a soft
  // accent-tint pill with the icon + label in the accent tone.
  const row = (item: NavItem, i: number) => {
    const active = pathname === item.href;
    return (
      <Dialog.Close
        key={item.href}
        nativeButton={false}
        style={{ ["--i" as string]: String(i) }}
        render={
          <Link
            href={hrefFor(item.href)}
            aria-current={active ? "page" : undefined}
            className="bk-nav-row flex items-center gap-3.5 rounded-[13px] px-3.5 py-2.5 text-[15px] font-semibold no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            style={
              active
                ? { background: "var(--accent)", color: "var(--color-primary)" }
                : { color: "var(--color-bk-ink)" }
            }
          >
            <item.Icon
              size={18}
              strokeWidth={1.9}
              aria-hidden="true"
              style={{ color: active ? "var(--color-primary)" : "var(--color-bk-muted)" }}
            />
            {item.label}
          </Link>
        }
      />
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="bk-hamburger group relative grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-background)] outline-none transition-colors hover:bg-[var(--color-bk-line-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 data-popup-open:bg-[var(--bk-accent)]"
        aria-label="Menu"
      >
        <span className="bk-burger" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-[oklch(18%_0.02_80/0.4)] backdrop-blur-[3px] transition-opacity duration-[400ms] data-closed:opacity-0 data-open:opacity-100" />
        <Dialog.Popup className="bk-sheet fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[86vh] w-full max-w-[520px] flex-col rounded-t-[30px] bg-[var(--color-bk-surface)] pt-2 pb-[max(16px,env(safe-area-inset-bottom))] outline-none">
          {/* nav rows — scroll if a short screen can't fit them all. No grab
              handle: it implied a drag gesture the sheet doesn't support;
              dismiss via backdrop tap, a row tap, or Escape. */}
          <nav aria-label="Primary" className="bk-scroll flex-1 overflow-y-auto px-3 pt-4">
            <div className="flex flex-col gap-1">
              {primary.map((item, i) => row(item, i))}
            </div>
            <div className="my-2.5 h-px bg-[var(--color-bk-line-soft)]" />
            <div className="flex flex-col gap-1">
              {secondary.map((item, i) => row(item, primary.length + i))}
            </div>
          </nav>

          {/* footer — account identity, then Settings + a red (danger) Log out
              button side by side. */}
          <div className="mt-1 border-t border-[var(--color-bk-line-soft)] px-3 pt-3">
            <div className="flex items-center gap-3 px-2.5 py-2">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                style={{ background: accent }}
                aria-hidden="true"
              >
                {initials ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-[var(--color-bk-ink)]">
                  {userName ?? "Your account"}
                </div>
                <div className="text-[11.5px] text-[var(--color-bk-faint)]">Free plan</div>
              </div>
            </div>
            <div className="mt-1 flex gap-2">
              <Dialog.Close
                render={
                  <Button variant="outline" size="sm" onClick={onOpenSettings} className="flex-1">
                    <Settings data-icon="inline-start" size={16} strokeWidth={2} aria-hidden="true" />
                    Settings
                  </Button>
                }
              />
              <Dialog.Close
                render={
                  <Button variant="danger" size="sm" onClick={onSignOut} className="flex-1">
                    <LogOut data-icon="inline-start" size={16} strokeWidth={2} aria-hidden="true" />
                    Log out
                  </Button>
                }
              />
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
