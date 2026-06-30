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
import { useSession, signOut } from "next-auth/react";
import { Home, List, CreditCard, Target, Sparkles, Bell, Plus, Settings, LogOut, PieChart, Repeat, Lightbulb } from "lucide-react";
import { AddTransactionModal } from "@/components/dashboard/modals/add-transaction-modal";
import { ImportModal } from "@/components/dashboard/modals/import-modal";
import { EditTransactionModal } from "@/components/dashboard/modals/edit-transaction-modal";
import { AddGoalModal } from "@/components/dashboard/modals/add-goal-modal";
import { EditGoalModal } from "@/components/dashboard/modals/edit-goal-modal";
import { AddAccountModal } from "@/components/dashboard/modals/add-account-modal";
import { EditAccountModal } from "@/components/dashboard/modals/edit-account-modal";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { SettingsModal } from "@/components/dashboard/modals/settings-modal";
import type { TransactionView, GoalView, AccountView, SpendCategory, BillView } from "@/lib/types";
import { DEFAULT_ACCENT, deriveTheme, themeVars, hueOf } from "@/components/bulga/theme";
import { LogoMark } from "@/components/bulga/logo";
import { MonthPicker } from "@/components/bulga/month-picker";
import { BulgaChromeProvider } from "@/components/bulga/chrome-context";
import { MONTH_NAMES } from "@/lib/constants";
import { resolvePeriod } from "@/lib/period";

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
function RailLink({ item, active, accent }: { item: NavItem; active: boolean; accent: string }) {
  const { Icon, label, href } = item;
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
  const { data: session } = useSession();
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
  const [editTx, setEditTx] = useState<TransactionView | null>(null);
  const [editGoal, setEditGoal] = useState<GoalView | null>(null);
  const [editAccount, setEditAccount] = useState<AccountView | null>(null);

  // Mutations live in the modals; refetch server data by re-running the active RSC.
  const refresh = () => router.refresh();

  // Switch the accent live AND persist it (fire-and-forget — UI already applied).
  const setAccent = useCallback((next: string) => {
    setAccentState(next);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent: next }),
    }).catch(() => {});
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
  const { month, year } = resolvePeriod(
    { month: searchParams.get("month"), year: searchParams.get("year") },
    { month: todayMonth, year: todayYear }
  );
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  // Commit a new period to the URL, preserving the active route so switching
  // month on /transactions stays on /transactions. The transition keeps the
  // current UI on screen (no blank flash) while the RSC refetches.
  const selectPeriod = useCallback(
    (m: number, y: number) => {
      startPeriodTransition(() => {
        const isToday = m === todayMonth && y === todayYear;
        router.push(isToday ? pathname : `${pathname}?month=${m}&year=${y}`, { scroll: false });
      });
    },
    [router, pathname, todayMonth, todayYear]
  );

  const userName = session?.user?.name ?? user.name ?? null;
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : null;

  const meta = TITLES[pathname] ?? TITLES["/dashboard"];
  const pageTitle = meta.title;
  const pageSub = meta.sub({ monthLabel, txThisMonth });
  const showPicker = !!meta.periodic;

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
      editTransaction: setEditTx,
      editGoal: setEditGoal,
      editAccount: setEditAccount,
    }),
    [accent, theme, setAccent]
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
            <div style={{ marginBottom: 24 }}>
              <LogoMark size={22} bg={accent} fg="#fff" />
            </div>

            <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PRIMARY_NAV.map((item) => (
                <RailLink key={item.href} item={item} active={pathname === item.href} accent={accent} />
              ))}
            </nav>

            <div style={{ height: 1, width: 24, background: "var(--color-bk-sidebar-line)", margin: "14px 0" }} />

            <nav aria-label="Brand" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SECONDARY_NAV.map((item) => (
                <RailLink key={item.href} item={item} active={pathname === item.href} accent={accent} />
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
                    <button type="button" role="menuitem" className="bk-menu-item" onClick={() => { setShowProfileMenu(false); signOut({ callbackUrl: "/login" }); }}>
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
                <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                  onClick={() => setShowNotifications((v) => !v)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 999,
                    border: "1px solid oklch(91% 0.006 85)", background: "oklch(98% 0.004 90)", color: "oklch(40% 0.012 80)", cursor: "pointer",
                  }}
                >
                  <Bell size={17} strokeWidth={1.9} aria-hidden="true" />
                </button>
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
                <button
                  type="button"
                  aria-label="Add"
                  aria-haspopup="menu"
                  aria-expanded={showAddMenu}
                  onClick={() => setShowAddMenu((v) => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 17px 0 14px", borderRadius: 999,
                    border: "none", background: "var(--bk-accent)", color: "#fff", fontFamily: "inherit", fontSize: 13.5,
                    fontWeight: 600, cursor: "pointer", boxShadow: `0 1px 2px oklch(40% 0.1 ${hueOf(accent)} / 0.3)`,
                  }}
                >
                  <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                  Add
                </button>
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
