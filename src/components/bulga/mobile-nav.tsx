"use client";

// Bulga mobile navigation — a premium bottom sheet that replaces the icon rail
// below the desktop breakpoint. Built on Base UI's Dialog (focus trap, backdrop,
// Escape, scroll-lock, portal). The trigger is an animated hamburger (three
// lines morph to an X); the sheet slides up from the bottom edge with a grab
// handle, rounded top, tinted icon tiles, a soft active state, and a staggered
// row reveal. Desktop keeps the icon rail — this whole control is display:none
// there (see .bk-hamburger / .bk-rail in globals.css).

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { Wordmark } from "@/components/bulga/logo";
import type { LucideIcon } from "lucide-react";

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
  // Each row is a Dialog.Close rendering a Link, so a tap navigates and dismisses
  // in one gesture. --i drives the staggered entrance. Active rows get a soft
  // accent tint + an accent left-edge bar (not a hard fill) and a filled icon
  // tile; inactive rows get a neutral tinted tile.
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
            className="bk-nav-row relative flex items-center gap-3.5 rounded-[15px] py-2.5 pl-3.5 pr-4 text-[15.5px] font-semibold no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            style={
              active
                ? { background: "var(--accent)", color: "var(--color-primary)" }
                : { color: "var(--color-bk-ink)" }
            }
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                style={{ background: accent }}
              />
            )}
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]"
              style={
                active
                  ? { background: accent, color: "#fff" }
                  : { background: "var(--color-bk-line-soft)", color: "var(--color-bk-muted)" }
              }
            >
              <item.Icon size={18} strokeWidth={1.9} />
            </span>
            {item.label}
          </Link>
        }
      />
    );
  };

  return (
    <Dialog.Root>
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
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-[oklch(20%_0.02_80/0.34)] backdrop-blur-[2px] transition-opacity duration-300 data-closed:opacity-0 data-open:opacity-100" />
        <Dialog.Popup className="bk-sheet fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[86vh] w-full max-w-[520px] flex-col rounded-t-[28px] border border-b-0 border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-16px_60px_oklch(20%_0.02_80/0.22)] outline-none">
          {/* grab handle */}
          <div className="flex justify-center pt-3 pb-1">
            <span aria-hidden="true" className="h-1 w-9 rounded-full bg-[var(--color-bk-line)]" />
          </div>

          {/* header — wordmark */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3">
            <Wordmark />
          </div>

          {/* nav rows — scroll if a short screen can't fit them all */}
          <nav aria-label="Primary" className="bk-scroll flex-1 overflow-y-auto px-3">
            <div className="flex flex-col gap-1">
              {primary.map((item, i) => row(item, i))}
            </div>
            <div className="my-2.5 h-px bg-[var(--color-bk-line-soft)]" />
            <div className="flex flex-col gap-1">
              {secondary.map((item, i) => row(item, primary.length + i))}
            </div>
          </nav>

          {/* footer — account + settings + sign out */}
          <div className="mt-1 border-t border-[var(--color-bk-line-soft)] px-3 pt-3">
            <div className="flex items-center gap-3 px-2.5 py-1.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                style={{ background: accent }}
                aria-hidden="true"
              >
                {initials ?? "?"}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-[var(--color-bk-ink)]">
                  {userName ?? "Your account"}
                </div>
                <div className="text-[11.5px] text-[var(--color-bk-faint)]">Free plan</div>
              </div>
            </div>
            <div className="mt-1 flex gap-2">
              <Dialog.Close
                render={
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-2.5 text-[14px] font-semibold text-[var(--color-bk-ink)] outline-none transition-colors hover:bg-[var(--color-bk-line-soft)]"
                  >
                    <Settings size={16} strokeWidth={2} aria-hidden="true" />
                    Settings
                  </button>
                }
              />
              <Dialog.Close
                render={
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-2.5 text-[14px] font-semibold text-[var(--color-bk-ink)] outline-none transition-colors hover:bg-[var(--color-bk-line-soft)]"
                  >
                    <LogOut size={16} strokeWidth={2} aria-hidden="true" />
                    Log out
                  </button>
                }
              />
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
