"use client";

// otterfund mobile navigation — a premium bottom sheet that replaces the icon rail
// below the desktop breakpoint. Built on Base UI's Dialog (focus trap, backdrop,
// Escape, scroll-lock, portal). The trigger is an animated hamburger (three
// lines morph to an X); the sheet slides up from the bottom edge with the same
// spring as the CRUD bottom sheets (ui/dialog.tsx ≤640px), so all sheets feel
// like one system. Inside: a grab handle you can flick down to dismiss, the
// engraved brand lockup over an engine-turned braid hairline (the Settings
// modal's divider language), tinted icon tiles per row, and a footer account
// card. Desktop keeps the icon rail — this whole control is display:none there
// (see .of-hamburger / .of-rail in globals.css).

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideProps } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { LogoMark } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { braid } from "@/components/otterfund/guilloche";
import type { OtterfundTheme } from "@/components/otterfund/theme";

// Must match the .of-hamburger / .of-rail breakpoint in globals.css: above this
// the hamburger is hidden and the icon rail takes over.
const DESKTOP_QUERY = "(min-width: 769px)";

// Dragged past this (px) when the finger lifts → dismiss; short of it → spring back.
const DRAG_CLOSE_PX = 90;

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<LucideProps>;
}

/** Eyebrow section label — the CardLabel voice, tuned for the sheet. */
function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--color-of-faint)]">
      {children}
    </div>
  );
}

export function MobileNav({
  primary,
  secondary,
  pathname,
  hrefFor,
  accent,
  theme,
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
  theme: OtterfundTheme;
  userName: string | null;
  initials: string | null;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  // Controlled so we can force-close when the viewport grows past the desktop
  // breakpoint: there the hamburger is hidden and the icon rail takes over, so a
  // still-open sheet would orphan over the desktop layout with nothing that
  // opened it. Base UI's open state is JS, not CSS, so it can't react to the
  // breakpoint on its own. The CSS guard in globals.css (.of-sheet hidden ≥769px)
  // is the visual backstop; this keeps the JS `open` state honest so the sheet
  // doesn't reappear when the viewport shrinks back to mobile.
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true); // SSR default desktop
  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  // Swipe-down-to-dismiss, scoped to the grip (handle + brand header) so it
  // never fights the nav list's own scrolling. While the finger is down the
  // sheet tracks it 1:1 (transition suspended); on release it either continues
  // down and closes — the inline translateY(100%) matches the CSS close state,
  // so Base UI's close transition picks up seamlessly from the finger's last
  // position — or springs back to rest. Inline styles die with the unmount.
  const popupRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const dragY = useRef(0);
  const onGripTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
    dragY.current = 0;
  };
  const onGripTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current == null) return;
    const dy = Math.max(0, e.touches[0].clientY - dragStart.current);
    dragY.current = dy;
    const el = popupRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    }
  };
  const onGripTouchEnd = () => {
    const el = popupRef.current;
    dragStart.current = null;
    if (!el) return;
    el.style.transition = "";
    if (dragY.current > DRAG_CLOSE_PX) {
      el.style.transform = "translateY(100%)";
      setOpen(false);
    } else {
      el.style.transform = "";
    }
    dragY.current = 0;
  };

  // Each row is a Dialog.Close rendering a Link, so a tap navigates and dismisses
  // in one gesture. --i drives the staggered entrance. Every row carries a small
  // tinted icon tile (the transaction-avatar language); the active row is the
  // emphasis — its tile fills with the accent and the row sits on the soft tint.
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
            className="of-nav-row flex items-center gap-3 rounded-[14px] px-2.5 py-[7px] text-[15px] font-semibold no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            style={
              active
                ? { background: "var(--accent)", color: "var(--color-primary)" }
                : { color: "var(--color-of-ink)" }
            }
          >
            <span
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]"
              style={
                active
                  ? { background: accent, color: "#fff" }
                  : {
                      background: "var(--color-of-canvas)",
                      color: "var(--color-of-muted)",
                      boxShadow: "inset 0 0 0 1px var(--color-of-line-soft)",
                    }
              }
            >
              <item.Icon size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            {item.label}
          </Link>
        }
      />
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="of-hamburger group relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-background)] outline-none transition-colors hover:bg-[var(--color-of-line-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 data-popup-open:bg-[var(--of-accent)]"
        aria-label="Menu"
      >
        <span className="of-burger" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="of-sheet-backdrop fixed inset-0 z-[60] bg-[oklch(20%_0.02_80/0.32)] transition-opacity duration-300 data-closed:opacity-0 data-open:opacity-100" />
        <Dialog.Popup
          ref={popupRef}
          className="of-sheet fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[86vh] w-full max-w-[520px] flex-col rounded-t-[30px] bg-[var(--color-of-surface)] pb-[max(16px,env(safe-area-inset-bottom))] outline-none"
        >
          {/* grip — grab handle + brand lockup, the swipe-down zone. The braid
              hairline beneath is the Settings modal's engine-turned divider,
              tinted by the live theme. */}
          <div
            className="of-sheet-grip"
            onTouchStart={onGripTouchStart}
            onTouchMove={onGripTouchMove}
            onTouchEnd={onGripTouchEnd}
            onTouchCancel={onGripTouchEnd}
          >
            <span className="of-sheet-handle" aria-hidden="true" />
            <div className="flex items-center gap-2 px-5 pb-3">
              <LogoMark size={30} />
              <Wordmark className="text-[19px] text-[var(--color-of-ink)]" />
            </div>
            <svg viewBox="0 0 400 12" preserveAspectRatio="none" className="block w-full" style={{ height: 8 }} aria-hidden="true">
              <path d={braid(400, 6, 3, 15, 0)} fill="none" stroke={theme.accentDeep} strokeWidth={0.9} opacity={0.4} />
              <path d={braid(400, 6, 3, 15, Math.PI)} fill="none" stroke={theme.accent} strokeWidth={0.9} opacity={0.45} />
            </svg>
          </div>

          {/* nav rows — scroll if a short screen can't fit them all */}
          <nav aria-label="Primary" className="of-scroll flex-1 overflow-y-auto px-3 pt-3">
            <SheetLabel>Menu</SheetLabel>
            <div className="flex flex-col gap-1">
              {primary.map((item, i) => row(item, i))}
            </div>
            <div className="mt-3">
              <SheetLabel>More</SheetLabel>
            </div>
            <div className="flex flex-col gap-1 pb-2">
              {secondary.map((item, i) => row(item, primary.length + i))}
            </div>
          </nav>

          {/* footer — the account, as a quiet canvas card: identity on top,
              Settings + a red (danger) Log out side by side beneath. */}
          <div className="mt-1 px-3 pt-1">
            <div className="rounded-[18px] border border-[var(--color-of-line-soft)] bg-[var(--color-of-canvas)] p-2.5">
              <div className="flex items-center gap-3 px-1.5 py-1.5">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: accent }}
                  aria-hidden="true"
                >
                  {initials ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[var(--color-of-ink)]">
                    {userName ?? "Your account"}
                  </div>
                  <div className="text-[11.5px] text-[var(--color-of-faint)]">Free plan</div>
                </div>
              </div>
              <div className="mt-1.5 flex gap-2">
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
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
