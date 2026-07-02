"use client";

// BulgaChrome — the persistent app shell rendered once by dashboard/layout.tsx
// and wrapping every routed page. Because a Next layout does not remount when
// navigating between its child routes, the accent + modal state held here
// survives navigation. Each section is its own route (/dashboard,
// /dashboard/transactions, …); the rail navigates with <Link> and reads the
// active route from usePathname, so deep links, back/forward and code-splitting
// all work. Shared client state is published through BulgaChromeContext.

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { gqlClient } from "@/lib/graphql/client";
import { Home, List, CreditCard, Target, Sparkles, Bell, Plus, Settings, LogOut, PieChart, Repeat, Lightbulb, Landmark } from "lucide-react";
import { AddTransactionModal } from "@/components/dashboard/modals/add-transaction-modal";
import { ImportModal } from "@/components/dashboard/modals/import-modal";
import { EditTransactionModal } from "@/components/dashboard/modals/edit-transaction-modal";
import { AddGoalModal } from "@/components/dashboard/modals/add-goal-modal";
import { EditGoalModal } from "@/components/dashboard/modals/edit-goal-modal";
import { AddAccountModal } from "@/components/dashboard/modals/add-account-modal";
import { EditAccountModal } from "@/components/dashboard/modals/edit-account-modal";
import { ConnectBankModal } from "@/components/dashboard/modals/connect-bank-modal";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { SettingsModal } from "@/components/dashboard/modals/settings-modal";
import type { TransactionView, GoalView, AccountView, SpendCategory, BillView } from "@/lib/types";
import { DEFAULT_ACCENT, deriveTheme, themeVars } from "@/components/bulga/theme";
import { LogoMark } from "@/components/bulga/logo";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/bulga/month-picker";
import { BulgaChromeProvider } from "@/components/bulga/chrome-context";
import { MONTH_NAMES } from "@/lib/constants";
import { resolvePeriod, type Period } from "@/lib/period";

const UPDATE_ACCENT = /* GraphQL */ `
  mutation UpdateAccent($accent: String) {
    updateSettings(input: { accent: $accent }) { ok }
  }
`;

// Where the last-picked period is remembered so it survives navigating through
// pages that DON'T carry it in the URL (Accounts, Goals, …). sessionStorage —
// so it persists page-to-page within a visit but resets on a fresh tab/visit.
const PERIOD_KEY = "bulga:period";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Home;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", Icon: Home },
  { href: "/dashboard/transactions", label: "Transactions", Icon: List },
  { href: "/dashboard/spending", label: "Spending", Icon: PieChart },
  { href: "/dashboard/subscriptions", label: "Subscriptions", Icon: Repeat },
  { href: "/dashboard/accounts", label: "Accounts", Icon: CreditCard },
  { href: "/dashboard/goals", label: "Goals", Icon: Target },
  { href: "/dashboard/insights", label: "Insights", Icon: Lightbulb },
];

const SECONDARY_NAV: NavItem[] = [{ href: "/dev/brand-kit", label: "Brand kit", Icon: Sparkles }];

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
  "/dashboard/subscriptions": { title: "Subscriptions", sub: () => "What’s on repeat" },
  "/dashboard/accounts": { title: "Accounts", sub: () => "Everything in one place" },
  "/dashboard/goals": { title: "Goals", sub: () => "Saving with intent" },
  "/dashboard/insights": { title: "Insights", sub: () => "AI-powered reads on your money" },
  "/dev/brand-kit": { title: "Brand kit", sub: () => "The Bulga design system" },
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
        className="bk-rail-btn flex h-[36px] w-[36px] items-center justify-center rounded-[11px] outline-none transition-[background,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        style={active ? { background: accent, color: "#fff" } : { color: "var(--color-bk-rail-icon)" }}
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
}

/** Notification inputs — read from the overview on the server. */
export interface ChromeNotice {
  budgetTarget: number;
  monthlySpend: number;
  spendingByCategory: SpendCategory[];
  upcomingBills: BillView[];
}

export function BulgaChrome({
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
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

  // Mutations live in the modals; refetch server data by re-running the active RSC.
  const refresh = () => router.refresh();

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/login";
  };

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

  const pageTitle = meta.title;
  // Prefer the count the active period page reported (accurate for the SELECTED
  // month); fall back to the layout's current-month count before it reports.
  const pageSub = meta.sub({ monthLabel, txThisMonth: txCount ?? txThisMonth });
  const showPicker = routeIsPeriodic;

  // Memoized so context consumers (every routed page) don't re-render on every
  // chrome render (modal open, menu toggle, period transition). The state
  // setters are stable; the only changing deps are accent/theme + setAccent.
  const chromeValue = useMemo(
    () => ({
      accent,
      theme,
      setAccent,
      addTransaction: () => setShowAdd(true),
      addGoal: () => setShowAddGoal(true),
      addAccount: () => setShowAddAccount(true),
      connectBank: (updateItemId?: string) => {
        setConnectUpdateItemId(updateItemId ?? null);
        setShowConnectBank(true);
      },
      editTransaction: setEditTx,
      editGoal: setEditGoal,
      editAccount: setEditAccount,
      refreshData: refresh,
      hrefFor,
      txCount,
      setTxCount,
    }),
    [accent, theme, setAccent, hrefFor, txCount]
  );

  return (
    <BulgaChromeProvider value={chromeValue}>
      <div
        style={
          {
            ...themeVars(theme),
            height: "100vh",
            display: "flex",
            background: "var(--color-bk-canvas)",
            overflow: "hidden",
          } as React.CSSProperties
        }
      >
        {/* ░░ ICON RAIL ░░ */}
        <aside
          style={{
            width: 60,
            flexShrink: 0,
            height: "100vh",
            background: "var(--color-bk-surface)",
            borderRight: "1px solid var(--color-bk-sidebar-line)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", padding: "20px 0" }}>
            <div style={{ marginBottom: 12 }}>
              <LogoMark size={42} />
            </div>

            <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PRIMARY_NAV.map((item) => (
                <RailLink key={item.href} item={item} href={hrefFor(item.href)} active={pathname === item.href} accent={accent} />
              ))}
            </nav>

            <div style={{ height: 1, width: 24, background: "var(--color-bk-sidebar-line)", margin: "14px 0" }} />

            <nav aria-label="Brand" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SECONDARY_NAV.map((item) => (
                <RailLink key={item.href} item={item} href={hrefFor(item.href)} active={pathname === item.href} accent={accent} />
              ))}
            </nav>

            <div style={{ flex: 1 }} />

            {/* profile avatar → popover */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((v) => !v)}
                aria-label={userName ?? "Account"}
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                style={{
                  width: 32, height: 32, borderRadius: "50%", background: "var(--bk-accent)", color: "#fff",
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

              {showProfileMenu && (
                <>
                  <div onClick={() => setShowProfileMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} aria-hidden="true" />
                  <div
                    role="menu"
                    style={{
                      position: "absolute", bottom: 0, left: "calc(100% + 12px)", zIndex: 50, minWidth: 208, padding: 6,
                      borderRadius: 14, background: "var(--color-bk-surface)", border: "1px solid var(--color-bk-line)",
                      boxShadow: "0 12px 32px oklch(20% 0.02 80 / 0.16)",
                    }}
                  >
                    <div style={{ padding: "8px 11px 10px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bk-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {userName ?? "Your account"}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--color-bk-faint)" }}>Free plan</div>
                    </div>
                    <div style={{ height: 1, background: "var(--color-bk-line-soft)", margin: "2px 0 4px" }} />
                    <button type="button" role="menuitem" className="bk-menu-item" onClick={() => { setShowProfileMenu(false); setShowSettings(true); }}>
                      <Settings size={15} strokeWidth={2} aria-hidden="true" />
                      Settings
                    </button>
                    <button type="button" role="menuitem" className="bk-menu-item" onClick={() => { setShowProfileMenu(false); handleSignOut(); }}>
                      <LogOut size={15} strokeWidth={2} aria-hidden="true" />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* ░░ MAIN ░░ */}
        <main style={{ flex: 1, minWidth: 0, height: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bk-surface)" }}>
          {/* topbar */}
          <header
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "22px 34px", borderBottom: "1px solid oklch(93% 0.005 85)",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-bk-ink)" }}>
                {pageTitle}
              </h1>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "oklch(54% 0.012 80)" }}>{pageSub}</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

              {/* bell */}
              <div style={{ position: "relative" }}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                  onClick={() => setShowNotifications((v) => !v)}
                >
                  <Bell size={17} strokeWidth={1.9} aria-hidden="true" />
                </Button>
                {showNotifications && (
                  <NotificationsPanel
                    budgetTarget={notice.budgetTarget}
                    monthlySpend={notice.monthlySpend}
                    spendingByCategory={notice.spendingByCategory}
                    upcomingBills={notice.upcomingBills}
                    onClose={() => setShowNotifications(false)}
                  />
                )}
              </div>

              {/* add */}
              <div style={{ position: "relative" }}>
                <Button
                  size="sm"
                  aria-label="Add"
                  aria-haspopup="menu"
                  aria-expanded={showAddMenu}
                  onClick={() => setShowAddMenu((v) => !v)}
                >
                  <Plus data-icon="inline-start" size={16} strokeWidth={2.4} aria-hidden="true" />
                  Add
                </Button>
                {showAddMenu && (
                  <>
                    <div onClick={() => setShowAddMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} aria-hidden="true" />
                    <div
                      role="menu"
                      style={{
                        position: "absolute", top: 46, right: 0, zIndex: 50, minWidth: 196, padding: 6, borderRadius: 14,
                        background: "var(--color-bk-surface)", border: "1px solid var(--color-bk-line)", boxShadow: "0 12px 32px oklch(20% 0.02 80 / 0.14)",
                      }}
                    >
                      <button type="button" role="menuitem" onClick={() => { setShowAddMenu(false); setShowAdd(true); }} className="bk-menu-item">
                        <Plus size={15} strokeWidth={2} aria-hidden="true" />
                        New transaction
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setShowAddMenu(false); setShowImport(true); }} className="bk-menu-item">
                        <List size={15} strokeWidth={2} aria-hidden="true" />
                        Import statement
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setShowAddMenu(false); setShowConnectBank(true); }} className="bk-menu-item">
                        <Landmark size={15} strokeWidth={2} aria-hidden="true" />
                        Connect a bank
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* scroll canvas — keyed by route so each page gets the bk-enter mount animation */}
          <div className="bk-scroll" style={{ flex: 1, overflowY: "auto", padding: 34 }} key={pathname}>
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
        <EditAccountModal open={!!editAccount} account={editAccount} onClose={() => setEditAccount(null)} onUpdated={() => { setEditAccount(null); refresh(); }} />
        <ConnectBankModal open={showConnectBank} updateItemId={connectUpdateItemId ?? undefined} onClose={() => setShowConnectBank(false)} onLinked={() => { refresh(); }} />
        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          accent={accent}
          onAccentChange={setAccent}
          user={user}
        />
      </div>
    </BulgaChromeProvider>
  );
}
