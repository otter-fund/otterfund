// otterfund first-run tour — the step script.
//
// buildOtterfundTour() returns the single "otterfund-first-run" tour, tailored
// to the user (first name), their state (hasAccounts) AND the viewport
// (isMobile). The chrome differs by breakpoint: on desktop the icon rail carries
// the nav, the bell + avatar; below 769px the rail is display:none and its job
// moves behind the hamburger menu (see .of-rail / .of-hamburger in globals.css).
// So every step that anchors to chrome resolves its selector/side/copy per
// viewport — the rail step points at the menu button, the bell step at the
// mobile bell slot, and the menu-only items (advisor, settings) spotlight the
// menu button too, since that's where you reach them on a phone.
//
// Anchors: every desktop step hooks a styling-free `[data-tour="…"]` on a real
// shell/page element — see otterfund-chrome.tsx (rail, mobile-menu, bell,
// bell-mobile, month-picker, nav-insights, profile-avatar), overview.tsx and
// empty-state.tsx.
//
// `side` is chosen per anchor to stay on-screen: NextStepjs centres the card on
// the target and only auto-flips top/bottom, so edge anchors need an aligned
// side. Top-right anchors (bell, month picker) open the card down-left
// (bottom-right); the top-left menu button opens down-right (bottom-left); the
// desktop avatar sits bottom-left → open it UP (top-left).
//
// Steps with no `selector` render as a centered card (welcome + the has-accounts
// finish). All steps opt into controls + skip so the custom TourCard can render
// Back / Next / Skip.

import type { Tour } from "nextstepjs";
import { Bell, CalendarClock, Compass, Palette, Plus, Wallet } from "lucide-react";
import { LogoMark, OtterFace } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";

export const TOUR_NAME = "otterfund-first-run";

// Shared per-step flags. `disableInteraction` makes the spotlight capture clicks
// so the highlighted element (e.g. a rail nav link) can't be clicked THROUGH the
// cutout — otherwise clicking a spotlighted nav icon navigates off /dashboard,
// where the later anchors don't exist, and the tour soft-locks. The tour is
// driven entirely by the card's Next/Back/Skip, so nothing needs to be clickable.
const CONTROLS = {
  showControls: true,
  showSkip: true,
  pointerRadius: 12,
  pointerPadding: 6,
  disableInteraction: true,
} as const;

export function buildOtterfundTour({
  firstName,
  hasAccounts,
  isMobile = false,
}: {
  firstName?: string | null;
  hasAccounts: boolean;
  /** Below the 769px rail breakpoint — nav lives behind the hamburger menu. */
  isMobile?: boolean;
}): Tour[] {
  const name = firstName?.trim().split(/\s+/)[0] || null;

  const steps: Tour["steps"] = [
    // 0 · Welcome — centered, no anchor.
    {
      icon: <LogoMark size={44} />,
      title: name ? `Welcome, ${name}` : "Welcome",
      content: <>A 30-second tour of where everything lives. You can skip whenever you like.</>,
      ...CONTROLS,
    },
    // 1 · Getting around. Desktop: the icon rail. Mobile: the hamburger menu,
    // which holds the same navigation.
    isMobile
      ? {
          icon: <Compass size={19} strokeWidth={1.9} />,
          title: "Find your way around",
          content: (
            <>
              Tap the menu to move between Overview, Transactions, Accounts, your advisor, and more.
              Every page is one tap away.
            </>
          ),
          selector: "[data-tour='mobile-menu']",
          side: "bottom-left",
          ...CONTROLS,
        }
      : {
          icon: <Compass size={19} strokeWidth={1.9} />,
          title: "Find your way around",
          content: (
            <>
              Every part of your app lives on this rail, always a click away. Hover any icon to see
              where it goes.
            </>
          ),
          selector: "[data-tour='rail']",
          side: "right",
          ...CONTROLS,
        },
    // 2 · Overview (page anchor — same on both).
    {
      icon: <Wallet size={19} strokeWidth={1.9} />,
      title: "Your money, at a glance",
      content: hasAccounts ? (
        <>Overview is home base. Net worth and cash flow sit front and center. Switch between them anytime.</>
      ) : (
        <>Overview is home base. Add an account and your net worth and cash flow appear right here.</>
      ),
      selector: "[data-tour='overview-hero']",
      side: "bottom",
      // The overview content scrolls inside .of-canvas (#of-tour-viewport), not
      // the window — measure/position the spotlight against that container so it
      // aligns to the greeting+hero box (no topbar/scroll offset).
      viewportID: "of-tour-viewport",
      ...CONTROLS,
      // A roomier spotlight for this large block (overrides the tight default the
      // small chrome targets use). Placed after ...CONTROLS so it wins.
      pointerPadding: 16,
      pointerRadius: 16,
    },
    // 3 · Month picker — present on both (rides the topbar actions on mobile too).
    {
      icon: <CalendarClock size={19} strokeWidth={1.9} />,
      title: "Move through time",
      content: (
        <>
          Pick a month here and <strong>Overview</strong>, <strong>Transactions</strong>, and{" "}
          <strong>Spending</strong> all follow along.
        </>
      ),
      selector: "[data-tour='month-picker']",
      // The picker sits top-right on desktop (open down-left) but top-left on
      // mobile (open down-right) — align the card so it stays on-screen.
      side: isMobile ? "bottom-left" : "bottom-right",
      ...CONTROLS,
    },
    // 4 · Advisor — the differentiator. Desktop spotlights its rail icon; on
    // mobile it lives inside the menu (under Insights), so we spotlight the menu
    // button — the actual place to reach it — rather than a locationless card.
    isMobile
      ? {
          icon: <OtterFace size={20} strokeWidth={1.9} />,
          title: "Meet your advisor",
          content: (
            <>
              Open the menu and tap <strong>Insights</strong> to ask anything in plain English, like{" "}
              <em>&ldquo;Can I afford this?&rdquo;</em> You&rsquo;ll get answers grounded in your own numbers.
            </>
          ),
          selector: "[data-tour='mobile-menu']",
          side: "bottom-left",
          ...CONTROLS,
        }
      : {
          icon: <OtterFace size={20} strokeWidth={1.9} />,
          title: "Meet your advisor",
          content: (
            <>
              Ask anything in plain English, like <em>&ldquo;Can I afford this?&rdquo;</em>{" "}
              You&rsquo;ll get answers grounded in your own numbers.
            </>
          ),
          selector: "[data-tour='nav-insights']",
          side: "right",
          ...CONTROLS,
        },
    // 5 · Notifications. The bell sits top-right on both, but in different slots
    // (desktop actions cluster vs the mobile title row) — anchor the visible one.
    {
      icon: <Bell size={19} strokeWidth={1.9} />,
      title: "Stay in the loop",
      content: <>Budget alerts and upcoming bills collect under the bell, so nothing slips by.</>,
      selector: isMobile ? "[data-tour='bell-mobile']" : "[data-tour='bell']",
      side: "bottom-right",
      ...CONTROLS,
    },
    // 6 · Make it yours. Desktop points at the avatar (opens the account menu);
    // on mobile Settings + Appearance live in the menu's footer, so spotlight the
    // menu button — the place to reach them.
    isMobile
      ? {
          icon: <Palette size={19} strokeWidth={1.9} />,
          title: "Make it yours",
          content: (
            <>
              Open the menu for <strong>Settings</strong>, and recolor the whole app under{" "}
              <strong>Appearance</strong>.
            </>
          ),
          selector: "[data-tour='mobile-menu']",
          side: "bottom-left",
          ...CONTROLS,
        }
      : {
          icon: <Palette size={19} strokeWidth={1.9} />,
          title: "Make it yours",
          content: (
            <>
              Manage your account in <strong>Settings</strong>, and recolor the whole app under{" "}
              <strong>Appearance</strong>.
            </>
          ),
          selector: "[data-tour='profile-avatar']",
          side: "top-left",
          ...CONTROLS,
        },
    // 7 · Activation finish (page anchor / centered — same on both).
    hasAccounts
      ? {
          icon: <OtterFace size={20} strokeWidth={1.9} />,
          title: "You're all set",
          content: <>That&rsquo;s the tour. Explore freely. Your advisor is here whenever you need it.</>,
          ...CONTROLS,
        }
      : {
          icon: <Plus size={19} strokeWidth={1.9} />,
          title: "Add your first account",
          content: (
            <>
              It all starts with one account. Connect a bank or add one by hand, and <Wordmark /> takes
              it from there.
            </>
          ),
          selector: "[data-tour='add-account-cta']",
          side: "top",
          ...CONTROLS,
        },
  ];

  return [{ tour: TOUR_NAME, steps }];
}
