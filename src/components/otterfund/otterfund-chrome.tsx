"use client";

// OtterfundChrome — the persistent app shell rendered once by dashboard/layout.tsx
// and wrapping every routed page. Because a Next layout does not remount when
// navigating between its child routes, the accent + modal state held here
// survives navigation. Each section is its own route (/dashboard,
// /dashboard/transactions, …); the rail navigates with <Link> and reads the
// active route from usePathname, so deep links, back/forward and code-splitting
// all work. Shared client state is published through OtterfundChromeContext.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { gqlClient } from "@/lib/graphql/client";
import { Home, List, CreditCard, Target, Sparkles, Bell, Plus, Settings, LogOut, PieChart, Landmark, TrendingUp, Gauge, SlidersHorizontal, type LucideProps } from "lucide-react";
import { AddTransactionModal } from "@/components/dashboard/modals/add-transaction-modal";
import { ImportModal } from "@/components/dashboard/modals/import-modal";
import { EditTransactionModal } from "@/components/dashboard/modals/edit-transaction-modal";
import { AddGoalModal } from "@/components/dashboard/modals/add-goal-modal";
import { EditGoalModal } from "@/components/dashboard/modals/edit-goal-modal";
import { AddAccountModal } from "@/components/dashboard/modals/add-account-modal";
import { AddSubscriptionModal } from "@/components/dashboard/modals/add-subscription-modal";
import { EditSubscriptionModal } from "@/components/dashboard/modals/edit-subscription-modal";
import { AddInvestmentModal } from "@/components/dashboard/modals/add-investment-modal";
import { EditInvestmentModal } from "@/components/dashboard/modals/edit-investment-modal";
import { EditAccountModal } from "@/components/dashboard/modals/edit-account-modal";
import { ConnectBankModal } from "@/components/dashboard/modals/connect-bank-modal";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { SettingsModal } from "@/components/dashboard/modals/settings-modal";
import type { TransactionView, GoalView, AccountView, SubscriptionView, InvestmentView, SpendCategory, BillView } from "@/lib/types";
import { DEFAULT_ACCENT, deriveTheme, themeVars } from "@/components/otterfund/theme";
import { LogoMark, OtterFace } from "@/components/otterfund/logo";
import { PlanBadgeIcon } from "@/components/otterfund/plan-badge-icon";
import { Button } from "@/components/ui/button";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MonthPicker } from "@/components/otterfund/month-picker";
import { MobileNav } from "@/components/otterfund/mobile-nav";
import { OtterfundChromeProvider } from "@/components/otterfund/chrome-context";
import { MONTH_NAMES } from "@/lib/constants";
import { resolvePeriod, type Period } from "@/lib/period";
import { canUse, toPlanTier, PLAN_META, type Feature, type PlanTier } from "@/lib/plans";

const UPDATE_ACCENT = /* GraphQL */ `
  mutation UpdateAccent($accent: String) {
    updateSettings(input: { accent: $accent }) { ok }
  }
`;

const CREATE_PORTAL = /* GraphQL */ `
  mutation CreatePortal {
    createBillingPortalSession
  }
`;

// Where the last-picked period is remembered so it survives navigating through
// pages that DON'T carry it in the URL (Accounts, Goals, …). sessionStorage —
// so it persists page-to-page within a visit but resets on a fresh tab/visit.
const PERIOD_KEY = "otterfund:period";

// Valid Settings tabs (mirror SettingsModal's SettingsTab) — used to validate the
// ?settings=<tab> URL param before opening the modal on it.
const SETTINGS_TABS = ["profile", "plan", "money", "connections", "appearance", "data"];

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<LucideProps>;
}

interface NavSection {
  /** Section eyebrow (shown on mobile; a divider stands in for it on the rail). */
  label: string;
  items: NavItem[];
}

// Grouped by mental model: FLOW = money moving over the month (period-scoped),
// HOLDINGS = what you have right now (balances), ADVISOR = the AI layer over it
// all. Subscriptions live inside Spending now; Investments inside Accounts.
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Flow",
    items: [
      { href: "/dashboard", label: "Overview", Icon: Home },
      { href: "/dashboard/transactions", label: "Transactions", Icon: List },
      { href: "/dashboard/spending", label: "Spending", Icon: PieChart },
    ],
  },
  {
    label: "Holdings",
    items: [
      { href: "/dashboard/accounts", label: "Accounts", Icon: CreditCard },
      { href: "/dashboard/goals", label: "Goals", Icon: Target },
    ],
  },
  {
    label: "Advisor",
    items: [{ href: "/dashboard/insights", label: "Insights", Icon: OtterFace }],
  },
];

// Internal staff tools — rendered only for isAdmin users (see the guard on each
// /dev route). Non-admins never see these rail entries.
const SECONDARY_NAV: NavItem[] = [
  { href: "/dev/brand-kit", label: "Brand kit", Icon: Sparkles },
  { href: "/dev/usage", label: "AI usage", Icon: Gauge },
  { href: "/dev/customize", label: "Customize", Icon: SlidersHorizontal },
];

/**
 * Per-route topbar config — the single source of route meta. `sub` formats the
 * subtitle (taking live data); `periodic: true` means the route's data is scoped
 * to the selected month/year, so the month picker shows ONLY there. Everywhere
 * else the period has no effect and the picker would falsely imply it does.
 */
type RouteMeta = {
  title: string;
  sub: (ctx: { monthLabel: string; txThisMonth: number }) => string;
  periodic?: boolean;
};
const TITLES: Record<string, RouteMeta> = {
  "/dashboard": { title: "Overview", sub: () => "Here’s where your money stands today", periodic: true },
  "/dashboard/transactions": { title: "Transactions", sub: ({ txThisMonth, monthLabel }) => `${txThisMonth} this month · ${monthLabel}`, periodic: true },
  "/dashboard/spending": { title: "Spending", sub: ({ monthLabel }) => `Budget vs. actual · ${monthLabel}`, periodic: true },
  "/dashboard/accounts": { title: "Accounts", sub: () => "Everything in one place" },
  "/dashboard/investments": { title: "Investments", sub: () => "Your portfolio and holdings" },
  "/dashboard/goals": { title: "Goals", sub: () => "Saving with intent" },
  "/dashboard/insights": { title: "Insights", sub: () => "Ask your advisor" },
  "/dev/brand-kit": { title: "Brand kit", sub: () => "The otterfund design system" },
  "/dev/usage": { title: "AI usage", sub: () => "Chat & insights cost per user" },
  "/dev/customize": { title: "Customize", sub: () => "Dev tools & previews" },
};

/** Icon-rail nav link with a tooltip that flies out to the right of the dark rail. */
function RailLink({ item, active, accent, href }: { item: NavItem; active: boolean; accent: string; href: string }) {
  const { Icon, label } = item;
  return (
    <div className="group relative flex justify-center">
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        title={label}
        className="of-rail-btn flex h-[36px] w-[36px] items-center justify-center rounded-[11px] outline-none transition-[background,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        style={active ? { background: accent, color: "#fff" } : { color: "var(--color-of-rail-icon)" }}
      >
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      </Link>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
        style={{ background: "oklch(26% 0.012 75)", color: "#fff", boxShadow: "0 8px 24px oklch(20% 0.02 80 / 0.3)" }}
      >
        {label}
      </span>
    </div>
  );
}

export interface ChromeUser {
  name: string;
  email: string;
  monthlyIncome: number;
  currency: string;
  budgetTarget: number;
  budgetPlan: string;
  /** Billing tier (free | standard | pro) — drives paywalls + the plan label. */
  plan: string;
  /** otterfund staff — unlocks the internal /dev tools in the rail. */
  isAdmin: boolean;
}

/** Notification inputs — read from the overview on the server. */
export interface ChromeNotice {
  budgetTarget: number;
  monthlySpend: number;
  spendingByCategory: SpendCategory[];
  upcomingBills: BillView[];
}

export function OtterfundChrome({
  initialAccent,
  user,
  notice,
  txThisMonth,
  todayMonth,
  todayYear,
  children,
}: {
  initialAccent: string | null;
  user: ChromeUser;
  notice: ChromeNotice;
  txThisMonth: number;
  /** Today's real period — the picker's "today" marker + the period fallback. */
  todayMonth: number;
  todayYear: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [periodPending, startPeriodTransition] = useTransition();

  const [accent, setAccentState] = useState<string>(initialAccent ?? DEFAULT_ACCENT);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Settings is a modal whose open state + active tab live in the URL (?settings=<tab>)
  // so it's deep-linkable and survives a round-trip to /pricing ("Change plan" →
  // pricing → "Back to Settings" reopens the same tab). Driven via the History API
  // (like the Insights view) so open/close/tab-switch never trigger a server refetch.
  const rawSettings = searchParams.get("settings");
  const showSettings = rawSettings != null;
  const settingsTab = SETTINGS_TABS.includes(rawSettings ?? "") ? (rawSettings as string) : "profile";
  // Remember the last-viewed tab so reopening the modal returns there (it used to
  // persist via the always-mounted modal's local state; the URL-driven version
  // resets on close, so we track it here). Kept current whenever the modal's open.
  const lastSettingsTab = useRef("profile");
  useEffect(() => {
    if (rawSettings != null) lastSettingsTab.current = settingsTab;
  }, [rawSettings, settingsTab]);
  const settingsUrl = useCallback(
    (tab: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab == null) params.delete("settings");
      else params.set("settings", tab);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );
  // Open adds a history entry (so Back closes it); tab-switch + close replace it.
  // With no explicit tab, reopen on the last-viewed one.
  const openSettings = useCallback(
    (tab?: string) => window.history.pushState(null, "", settingsUrl(tab ?? lastSettingsTab.current)),
    [settingsUrl],
  );
  const setSettingsTab = useCallback(
    (tab: string) => window.history.replaceState(null, "", settingsUrl(tab)),
    [settingsUrl],
  );
  const closeSettings = useCallback(
    () => window.history.replaceState(null, "", settingsUrl(null)),
    [settingsUrl],
  );
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [editSubscription, setEditSubscription] = useState<SubscriptionView | null>(null);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [editInvestment, setEditInvestment] = useState<InvestmentView | null>(null);
  const [showConnectBank, setShowConnectBank] = useState(false);
  const [connectUpdateItemId, setConnectUpdateItemId] = useState<string | null>(null);
  const [editTx, setEditTx] = useState<TransactionView | null>(null);
  const [editGoal, setEditGoal] = useState<GoalView | null>(null);
  const [editAccount, setEditAccount] = useState<AccountView | null>(null);
  // Period-scoped tx count reported by the transactions page (see chrome-context).
  const [txCount, setTxCount] = useState<number | null>(null);
  // Clear it when leaving the transactions route so no stale count lingers.
  useEffect(() => {
    if (pathname !== "/dashboard/transactions") setTxCount(null);
  }, [pathname]);

  // Topbar collapse for phones: scroll down tucks the subtitle + actions row
  // away (`.of-topbar[data-collapsed]`, ≤768px — desktop ignores it). Phones
  // scroll the DOCUMENT (≤768px block in globals.css), so the listener lives
  // on the window; desktop's window never scrolls, so it stays quiet.
  //
  // Guards below filter phantom deltas (layout re-clamps, iOS rubber-band,
  // Safari chrome retraction) so only real scrolling moves the bar. Use
  // innerHeight, not clientHeight — iOS freezes the latter at the small
  // viewport, putting the computed bottom ~100px above the real one.
  const [navCollapsed, setNavCollapsed] = useState(false);
  useEffect(() => {
    setNavCollapsed(false);
    const doc = document.scrollingElement;
    if (!doc) return;
    let lastY = Math.max(0, doc.scrollTop);
    let upRun = 0;
    const onScroll = () => {
      const max = doc.scrollHeight - window.innerHeight;
      const y = doc.scrollTop;
      if (y < 0 || y > max) {
        // Rubber-band overscroll — resync and wait for real positions.
        lastY = Math.max(0, Math.min(y, max));
        return;
      }
      const dy = y - lastY;
      lastY = y;
      if (y < 40) {
        upRun = 0;
        setNavCollapsed(false);
      } else if (y > max - 80) {
        return; // bottom band — hold state
      } else if (dy > 4) {
        upRun = 0;
        if (max > 160) setNavCollapsed(true);
      } else if (dy < 0) {
        upRun -= dy;
        if (upRun > 24) {
          upRun = 0;
          setNavCollapsed(false);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Mutations live in the modals; refetch server data by re-running the active RSC.
  const refresh = () => router.refresh();

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/login";
  };

  const plan: PlanTier = toPlanTier(user.plan);

  // Prompt an upgrade for a locked feature — send the user straight to the
  // pricing page (no interstitial modal). Carry the origin route as `?from=` so
  // pricing can offer a "Back to <page>" return link instead of a generic one.
  const pricingHref = useCallback(() => {
    // Preserve an open Settings tab in the origin so pricing can return there
    // (e.g. Settings → Plan → Change plan → "Back to Settings" reopens Plan).
    const origin = rawSettings != null ? `${pathname}?settings=${settingsTab}` : pathname;
    return `/pricing?from=${encodeURIComponent(origin)}`;
  }, [pathname, rawSettings, settingsTab]);
  const promptUpgrade = useCallback(() => router.push(pricingHref()), [router, pricingHref]);

  // Gate an action: returns true (proceed) when the plan includes the feature,
  // otherwise sends the user to pricing and returns false. Callers do
  // `if (!requireFeature("bank_sync")) return;` before the gated action.
  const requireFeature = useCallback(
    (feature: Feature) => {
      if (canUse(plan, feature)) return true;
      router.push(pricingHref());
      return false;
    },
    [plan, router, pricingHref],
  );

  // Send the user to Stripe's hosted portal to manage/cancel their plan.
  const openBillingPortal = useCallback(() => {
    gqlClient
      .request<{ createBillingPortalSession: string }>(CREATE_PORTAL)
      .then((r) => {
        window.location.href = r.createBillingPortalSession;
      })
      .catch(() => router.push("/pricing"));
  }, [router]);

  // After returning from Stripe Checkout (?checkout=success), the webhook has
  // (usually) already written the new plan — re-run the RSC tree to pick it up,
  // then strip the query param so a refresh doesn't re-trigger.
  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    router.refresh();
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Switch the accent live AND persist it (fire-and-forget — UI already applied).
  const setAccent = useCallback((next: string) => {
    setAccentState(next);
    gqlClient.request(UPDATE_ACCENT, { accent: next }).catch(() => {});
  }, []);

  // Memoized so the object identity is stable across renders that don't change
  // the accent — otherwise the :root effect below would re-run every render.
  const theme = useMemo(() => deriveTheme(accent), [accent]);

  // Push accent-derived tokens onto :root so they reach EVERYTHING — including
  // modals, which portal into document.body outside this subtree.
  useEffect(() => {
    const root = document.documentElement;
    const vars = themeVars(theme);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [theme]);

  // The selected period is the URL's source of truth (?month=&year=), resolved
  // the SAME way the server pages do (shared resolvePeriod) so URL == data.
  const urlMonth = searchParams.get("month");
  const urlYear = searchParams.get("year");
  const { month, year } = resolvePeriod(
    { month: urlMonth, year: urlYear },
    { month: todayMonth, year: todayYear }
  );
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  // Commit a new period to the URL, preserving the active route so switching
  // month on /transactions stays on /transactions. The transition keeps the
  // current UI on screen (no blank flash) while the RSC refetches. Persistence
  // (state + storage) is handled by the URL-sync effect below — this push
  // updates the URL, which the effect observes; one owner for storage.
  const selectPeriod = useCallback(
    (m: number, y: number) => {
      const isToday = m === todayMonth && y === todayYear;
      startPeriodTransition(() => {
        router.push(isToday ? pathname : `${pathname}?month=${m}&year=${y}`, { scroll: false });
      });
    },
    [router, pathname, todayMonth, todayYear]
  );

  const meta = TITLES[pathname] ?? TITLES["/dashboard"];
  const routeIsPeriodic = !!meta.periodic;

  // The period remembered across navigation, held as React state (not read from
  // storage during render — storage isn't reactive, and reading it in the
  // initializer would make the first client render differ from the server's
  // (null), causing a hydration mismatch on the nav hrefs). Always starts null
  // to match SSR; the effect below hydrates it from sessionStorage AFTER mount.
  const [remembered, setRemembered] = useState<Period | null>(null);

  // Post-hydration seed: pull the last-picked period from sessionStorage once,
  // but only if the URL isn't already authoritative here (a periodic route with
  // ?month=&year= wins — the URL-sync effect handles that). Runs client-only,
  // so it never affects SSR output. Nav hrefs pick up the value on the render
  // after mount, which is fine — links aren't clicked during hydration.
  useEffect(() => {
    if (routeIsPeriodic && urlMonth != null) return; // URL wins; sync effect owns it
    try {
      const stored = sessionStorage.getItem(PERIOD_KEY);
      if (!stored) return;
      const [sm, sy] = stored.split("-").map(Number);
      const p = resolvePeriod({ month: String(sm), year: String(sy) }, { month: todayMonth, year: todayYear });
      const next = p.month === todayMonth && p.year === todayYear ? null : p;
      setRemembered((prev) =>
        prev?.month === next?.month && prev?.year === next?.year ? prev : next
      );
    } catch {}
    // Run once on mount; the URL-sync effect keeps it current thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On a periodic route the URL is authoritative — sync it into `remembered` +
  // storage. A BARE url (no ?month=&year=) means "this month", which must CLEAR
  // the memory, not be skipped: going back to today drops the params, and if we
  // bailed on the missing params the stale month would linger and re-attach to
  // the next nav link. Non-periodic routes leave the memory untouched (their
  // bare URL says nothing about the period). No router.replace → no "jumpy"
  // second fetch on load.
  useEffect(() => {
    if (!routeIsPeriodic) return;
    const isToday = month === todayMonth && year === todayYear;
    const next = isToday ? null : { month, year };
    setRemembered((prev) =>
      prev?.month === next?.month && prev?.year === next?.year ? prev : next
    );
    try {
      if (isToday) sessionStorage.removeItem(PERIOD_KEY);
      else sessionStorage.setItem(PERIOD_KEY, `${month}-${year}`);
    } catch {}
  }, [routeIsPeriodic, urlMonth, urlYear, month, year, todayMonth, todayYear]);

  // Append the remembered period to periodic-route hrefs so navigating there
  // preserves the month; non-periodic routes stay clean (period is inert there).
  // Destination URLs are born correct — the RSC fetches the right month on its
  // FIRST render, with no post-mount redirect.
  const hrefFor = useCallback(
    (href: string) =>
      remembered && !!TITLES[href]?.periodic
        ? `${href}?month=${remembered.month}&year=${remembered.year}`
        : href,
    [remembered]
  );

  const userName = user.name ?? null;
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : null;

  // The notifications bell, rendered in TWO slots: inside the actions cluster
  // on desktop, and up on the title row on mobile (see .of-bell-top /
  // .of-bell-inline in globals.css — exactly one is visible at a time). Two
  // instances beat re-parenting: each Popover owns its own anchor + state, and
  // the mobile one stays reachable even when the bar collapses on scroll.
  // Base UI's Popover owns positioning, scrim, focus & dismissal; its
  // positioner keeps the panel on-screen.
  const bell = (
    <Popover>
      <PopoverTrigger
        aria-haspopup="dialog"
        render={
          <Button variant="outline" size="icon" aria-label="Notifications">
            <Bell size={17} strokeWidth={1.9} aria-hidden="true" />
          </Button>
        }
      />
      <PopoverContent className="rounded-2xl">
        <NotificationsPanel
          budgetTarget={notice.budgetTarget}
          monthlySpend={notice.monthlySpend}
          spendingByCategory={notice.spendingByCategory}
          upcomingBills={notice.upcomingBills}
        />
      </PopoverContent>
    </Popover>
  );

  const pageTitle = meta.title;
  // Prefer the count the active period page reported (accurate for the SELECTED
  // month); fall back to the layout's current-month count before it reports.
  const pageSub = meta.sub({ monthLabel, txThisMonth: txCount ?? txThisMonth });
  const showPicker = routeIsPeriodic;
  // Insights is a chat/AI workspace, not a place to add records — hide the Add
  // menu there and leave just the notifications bell.
  const showAddMenu = pathname !== "/dashboard/insights";

  // Memoized so context consumers (every routed page) don't re-render on every
  // chrome render (modal open, menu toggle, period transition). The state
  // setters are stable; the only changing deps are accent/theme + setAccent.
  const chromeValue = useMemo(
    () => ({
      accent,
      theme,
      setAccent,
      plan,
      requireFeature,
      promptUpgrade,
      openBillingPortal,
      addTransaction: () => setShowAdd(true),
      addGoal: () => setShowAddGoal(true),
      addAccount: () => setShowAddAccount(true),
      addSubscription: () => setShowAddSubscription(true),
      addInvestment: () => {
        if (!requireFeature("investments")) return;
        setShowAddInvestment(true);
      },
      connectBank: (updateItemId?: string) => {
        // Reconnect (update mode) is for an existing linked item — allow it even
        // at/over the plan cap. A brand-new connection is gated on bank sync.
        if (!updateItemId && !requireFeature("bank_sync")) return;
        setConnectUpdateItemId(updateItemId ?? null);
        setShowConnectBank(true);
      },
      editTransaction: setEditTx,
      editGoal: setEditGoal,
      editAccount: setEditAccount,
      editSubscription: setEditSubscription,
      editInvestment: setEditInvestment,
      refreshData: refresh,
      hrefFor,
      txCount,
      setTxCount,
    }),
    [accent, theme, setAccent, hrefFor, txCount, plan, requireFeature, promptUpgrade, openBillingPortal]
  );

  return (
    <OtterfundChromeProvider value={chromeValue}>
      {/* .of-vh = 100dvh with a 100vh fallback — plain 100vh on iOS Safari
          includes the retracted-toolbar band, cutting the bottom of the app. */}
      <div
        className="of-shell of-vh"
        style={
          {
            ...themeVars(theme),
            display: "flex",
            background: "var(--color-of-canvas)",
          } as React.CSSProperties
        }
      >
        {/* ░░ ICON RAIL ░░ */}
        <aside
          className="of-rail of-vh"
          style={{
            width: 60,
            flexShrink: 0,
            background: "var(--color-of-surface)",
            borderRight: "1px solid var(--color-of-sidebar-line)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", padding: "20px 0" }}>
            <div style={{ marginBottom: 12 }}>
              <LogoMark size={38} />
            </div>

            {/* Primary nav — the Flow · Holdings · Advisor groups render as one
                continuous, evenly-spaced run of icons on the rail (no inter-group
                dividers); the mobile sheet is where the section labels show. */}
            <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {NAV_SECTIONS.flatMap((section) => section.items).map((item) => (
                <RailLink key={item.href} item={item} href={hrefFor(item.href)} active={pathname === item.href} accent={accent} />
              ))}
            </nav>

            {user.isAdmin && (
              <>
                <div style={{ height: 1, width: 24, background: "var(--color-of-sidebar-line)", margin: "14px 0" }} />

                <nav aria-label="Dev tools" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SECONDARY_NAV.map((item) => (
                    <RailLink key={item.href} item={item} href={hrefFor(item.href)} active={pathname === item.href} accent={accent} />
                  ))}
                </nav>
              </>
            )}

            <div style={{ flex: 1 }} />

            {/* profile avatar → menu. Opens to the right of the rail; the
                positioner flips/shifts to stay on-screen. */}
            <Menu>
              <MenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={userName ?? "Account"}
                    style={{
                      width: 32, height: 32, borderRadius: "50%", background: "var(--of-accent)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700,
                      flexShrink: 0, border: "none", cursor: "pointer", outline: "none",
                    }}
                  >
                    {initials ?? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="8" r="3.4" />
                        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                      </svg>
                    )}
                  </button>
                }
              />
              <MenuContent side="right" align="end" className="min-w-[208px]">
                <div style={{ padding: "8px 11px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-of-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {userName ?? "Your account"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-of-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {PLAN_META[plan].label}
                    <PlanBadgeIcon plan={plan} />
                  </div>
                </div>
                <div style={{ height: 1, background: "var(--color-of-line-soft)", margin: "2px 0 4px" }} />
                <MenuItem onClick={() => openSettings()}>
                  <Settings size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Settings</span>
                </MenuItem>
                <MenuItem onClick={() => handleSignOut()} className="text-[var(--color-of-clay)]">
                  <LogOut size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Log out</span>
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </aside>

        {/* ░░ MAIN ░░ */}
        <main className="of-vh" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--color-of-surface)" }}>
          {/* topbar */}
          <header
            className="of-topbar"
            data-collapsed={navCollapsed || undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "22px 34px", borderBottom: "1px solid oklch(93% 0.005 85)",
            }}
          >
            <div className="of-topbar-lead" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <MobileNav
                sections={NAV_SECTIONS}
                secondary={user.isAdmin ? SECONDARY_NAV : []}
                pathname={pathname}
                hrefFor={hrefFor}
                accent={accent}
                theme={theme}
                userName={userName}
                initials={initials}
                planLabel={PLAN_META[plan].label}
                plan={plan}
                onOpenSettings={() => openSettings()}
                onSignOut={handleSignOut}
              />
              <div className="of-topbar-title" style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-of-ink)" }}>
                  {pageTitle}
                </h1>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "oklch(54% 0.012 80)" }}>{pageSub}</p>
              </div>
              {/* mobile-only bell — rides the title row, right-aligned */}
              <span className="of-bell-inline">{bell}</span>
            </div>

            <div className="of-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* month picker — only on period-scoped routes (overview /
                  transactions / spending); hidden elsewhere where it'd be inert */}
              {showPicker && (
                <MonthPicker
                  month={month}
                  year={year}
                  todayMonth={todayMonth}
                  todayYear={todayYear}
                  accent={accent}
                  theme={theme}
                  pending={periodPending}
                  onSelect={selectPeriod}
                />
              )}

              {/* desktop-only bell — hidden on mobile, where it rides the title row */}
              <span className="of-bell-top">{bell}</span>

              {/* add — Base UI Menu owns open state, scrim, focus & Escape; its
                  positioner keeps the menu on-screen at any viewport. Hidden on
                  Insights, which is a chat workspace, not a records surface. */}
              {showAddMenu && (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button size="sm" aria-label="Add">
                        <Plus data-icon="inline-start" size={16} strokeWidth={2.4} aria-hidden="true" />
                        Add
                      </Button>
                    }
                  />
                  <MenuContent>
                    <MenuItem onClick={() => setShowAdd(true)}>
                      <Plus size={15} strokeWidth={2} aria-hidden="true" />
                      <span>New transaction</span>
                    </MenuItem>
                    <MenuItem onClick={() => { if (requireFeature("investments")) setShowAddInvestment(true); }}>
                      <TrendingUp size={15} strokeWidth={2} aria-hidden="true" />
                      <span>New investment</span>
                    </MenuItem>
                    <MenuItem onClick={() => setShowImport(true)}>
                      <List size={15} strokeWidth={2} aria-hidden="true" />
                      <span>Import statement</span>
                    </MenuItem>
                    <MenuItem onClick={() => { if (requireFeature("bank_sync")) setShowConnectBank(true); }}>
                      <Landmark size={15} strokeWidth={2} aria-hidden="true" />
                      <span>Connect a bank</span>
                    </MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </div>
          </header>

          {/* scroll canvas — keyed by route so each page gets the of-enter mount animation */}
          <div className="of-scroll of-canvas" style={{ flex: 1, padding: 34 }} key={pathname}>
            {children}
          </div>
        </main>

        {/* CRUD + settings modals — owned by the chrome, opened via context */}
        <AddTransactionModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); refresh(); }} />
        <ImportModal open={showImport} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); refresh(); }} />
        <EditTransactionModal open={!!editTx} transaction={editTx} onClose={() => setEditTx(null)} onUpdated={() => { setEditTx(null); refresh(); }} />
        <AddGoalModal open={showAddGoal} onClose={() => setShowAddGoal(false)} onAdded={() => { setShowAddGoal(false); refresh(); }} />
        <EditGoalModal open={!!editGoal} goal={editGoal} onClose={() => setEditGoal(null)} onUpdated={() => { setEditGoal(null); refresh(); }} />
        <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} onAdded={() => { setShowAddAccount(false); refresh(); }} />
        <AddSubscriptionModal open={showAddSubscription} onClose={() => setShowAddSubscription(false)} onAdded={() => { setShowAddSubscription(false); refresh(); }} />
        <EditSubscriptionModal open={!!editSubscription} subscription={editSubscription} onClose={() => setEditSubscription(null)} onUpdated={() => { setEditSubscription(null); refresh(); }} />
        <AddInvestmentModal open={showAddInvestment} onClose={() => setShowAddInvestment(false)} onAdded={() => { setShowAddInvestment(false); refresh(); }} />
        <EditInvestmentModal open={!!editInvestment} investment={editInvestment} onClose={() => setEditInvestment(null)} onUpdated={() => { setEditInvestment(null); refresh(); }} />
        <EditAccountModal open={!!editAccount} account={editAccount} onClose={() => setEditAccount(null)} onUpdated={() => { setEditAccount(null); refresh(); }} />
        <ConnectBankModal open={showConnectBank} updateItemId={connectUpdateItemId ?? undefined} onClose={() => setShowConnectBank(false)} onLinked={() => { refresh(); }} />
        <SettingsModal
          open={showSettings}
          onClose={closeSettings}
          initialTab={settingsTab}
          onTabChange={setSettingsTab}
          accent={accent}
          onAccentChange={setAccent}
          user={user}
        />
      </div>
    </OtterfundChromeProvider>
  );
}
