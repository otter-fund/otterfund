"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/lib/legal";
import { Tabs, type TabItem } from "@/components/otterfund/tabs";
import { Wordmark } from "@/components/otterfund/wordmark";
import { PlanBadgeIcon } from "@/components/otterfund/plan-badge-icon";
import { Menu, MenuTrigger, MenuContent, MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";
import { SchemePicker } from "@/components/otterfund/scheme-picker";
import { AppearancePicker } from "@/components/otterfund/appearance-picker";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { braid } from "@/components/otterfund/guilloche";
import { ConfirmButton } from "@/components/otterfund/confirm-button";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import { createClient } from "@/lib/supabase/client";
import { gqlClient } from "@/lib/graphql/client";
import { BudgetPlanPicker } from "@/components/otterfund/budget-plan-picker";
import { User, Wallet, ShieldAlert, ChevronDown, Database, Palette, Trash2, Check, Landmark, Send, Unlink, RefreshCw, Loader2, Plus, CreditCard, ArrowLeftRight, Lock, ArrowRight } from "lucide-react";
import { OtterFace } from "@/components/otterfund/logo";
import { TelegramGlyph, WhatsAppGlyph } from "@/components/otterfund/messaging-icons";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { CURRENCIES, getBudgetPlan } from "@/lib/constants";
import { PLAN_META, FEATURE_COPY, FEATURE_REQUIRED_TIER, canUse, type Feature } from "@/lib/plans";
import type { OtterfundTheme, AppearanceMode } from "@/components/otterfund/theme";

const PLAID_ITEMS = /* GraphQL */ `
  query PlaidItems {
    plaidItems {
      itemId
      institutionName
      status
      lastSyncedAt
      accountCount
      domain
    }
  }
`;

const UNLINK_PLAID_ITEM = /* GraphQL */ `
  mutation UnlinkPlaidItem($itemId: ID) {
    unlinkPlaidItem(itemId: $itemId) { ok }
  }
`;

const UPDATE_SETTINGS = /* GraphQL */ `
  mutation UpdateSettings($input: SettingsUpdateInput!) {
    updateSettings(input: $input) { ok }
  }
`;

const UPDATE_BUDGET_PLAN = /* GraphQL */ `
  mutation UpdateBudgetPlan($planId: String!) {
    updateBudgetPlan(planId: $planId) { ok }
  }
`;

const DELETE_MY_ACCOUNT = /* GraphQL */ `
  mutation DeleteMyAccount {
    deleteMyAccount { ok }
  }
`;

const MESSAGING_CONNECTIONS = /* GraphQL */ `
  query MessagingConnections {
    messagingConnections
  }
`;

const START_MESSAGING_LINK = /* GraphQL */ `
  mutation StartMessagingLink($provider: String!) {
    startMessagingLink(provider: $provider)
  }
`;

const DISCONNECT_MESSAGING = /* GraphQL */ `
  mutation DisconnectMessaging($provider: String!) {
    disconnectMessaging(provider: $provider)
  }
`;

type SettingsTab = "profile" | "plan" | "money" | "connections" | "appearance" | "data";

const TABS: TabItem[] = [
  { value: "profile", label: "Profile", icon: User },
  { value: "plan", label: "Plan", icon: CreditCard },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "money", label: "Money", icon: Wallet },
  { value: "connections", label: "Connections", icon: Landmark },
  { value: "data", label: "Data", icon: Database },
];

interface PlaidConnection {
  itemId: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  accountCount: number;
  domain: string | null;
}

type MessagingProviderId = "telegram" | "whatsapp";

interface MessagingConn {
  provider: MessagingProviderId;
  status: string; // pending | active | disconnected
  configured: boolean; // server has this provider's tokens set
}

// The two channels shown in the messaging subsection. `startVerb` is the button
// the user taps in the chat app to finish linking (Telegram "Start" / WhatsApp "Send").
const MESSAGING_PROVIDERS_META: {
  provider: MessagingProviderId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  startVerb: string;
}[] = [
  { provider: "telegram", label: "Telegram", icon: TelegramGlyph, hint: "Free, instant setup.", startVerb: "Start" },
  { provider: "whatsapp", label: "WhatsApp", icon: WhatsAppGlyph, hint: "Chat from your WhatsApp.", startVerb: "Send" },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    monthlyIncome: number;
    currency: string;
    budgetTarget: number;
    budgetPlan: string;
  };
  /** Active accent + setter — the Appearance tab hosts the theme picker. */
  accent: string;
  onAccentChange: (accent: string) => void;
  /** Active colour scheme + setter — the Appearance tab hosts the theme toggle. */
  appearance: AppearanceMode;
  onAppearanceChange: (mode: AppearanceMode) => void;
  onSaved?: () => void;
  /** Tab to open on (from the ?settings=<tab> URL param). Defaults to profile. */
  initialTab?: string;
  /** Called when the active tab changes so the parent can reflect it in the URL. */
  onTabChange?: (tab: string) => void;
  /** Replays the first-run product tour — the Profile tab hosts the entry point
      (moved here from the profile menu). */
  onTakeTour?: () => void;
}

const fieldLabelCls =
  "block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5";

function SectionHead({
  icon: Icon,
  title,
  desc,
  tone = "accent",
}: {
  icon: typeof User;
  title: string;
  desc: React.ReactNode;
  tone?: "accent" | "clay";
}) {
  const tint = tone === "clay" ? "var(--color-of-clay-tint)" : "var(--accent)";
  const ink = tone === "clay" ? "var(--color-of-clay)" : "var(--color-primary)";
  return (
    <div className="flex items-start gap-3 mb-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: tint, color: ink }}
      >
        <Icon className="w-[17px] h-[17px]" strokeWidth={1.9} />
      </div>
      <div>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-of-ink)] leading-tight">
          {title}
        </h3>
        <p className="text-[12.5px] text-[var(--color-of-muted)] mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// Bank sync is a paid capability — on Free the Connections tab shows this
// on-brand upsell in place of the connect flow, built from the same language as
// the full-page LockedFeature panel (accent-tint field + drifting guilloché,
// the otter mark, a Newsreader title, accent-tint perk chips) so it reads like
// otterfund rather than a generic "locked" notice. The CTA points at the lowest
// tier that unlocks bank sync (source of truth: FEATURE_REQUIRED_TIER).
function ConnectionsUpsell({
  theme,
  onUpgrade,
  feature = "bank_sync",
}: {
  theme: OtterfundTheme;
  onUpgrade: () => void;
  feature?: Feature;
}) {
  const copy = FEATURE_COPY[feature];
  const tierName = PLAN_META[FEATURE_REQUIRED_TIER[feature]].name;
  return (
    <div
      className="max-w-[460px] overflow-hidden rounded-[20px]"
      style={{ background: "var(--color-of-surface)", border: "1px solid var(--color-of-line)" }}
    >
      <div
        className="relative overflow-hidden px-7 pb-6 pt-7"
        style={{ background: `linear-gradient(180deg, ${theme.accentTint}, transparent)` }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <GuillocheFlow accent={theme.accent} accentDeep={theme.accentDeep} opacity={0.08} fade="radial" speed={3} />
        </div>
        <div className="relative flex items-start gap-4">
          <div className="flex shrink-0 items-center justify-center" style={{ color: theme.accentDeep }}>
            <OtterFace size={34} />
          </div>
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: theme.accentDeep }}
            >
              <Lock className="h-2.5 w-2.5" strokeWidth={2.4} /> {tierName} feature
            </span>
            <h3
              className="mt-2 text-[21px] leading-tight tracking-[-0.01em] text-[var(--color-of-ink)]"
              style={{ fontFamily: "var(--font-num), Georgia, serif", fontWeight: 500 }}
            >
              {copy.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-of-muted)]">{copy.blurb}</p>
          </div>
        </div>
      </div>

      <div className="px-7 pb-6 pt-5">
        <ul className="flex flex-col gap-2.5">
          {copy.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5">
              <span
                className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                style={{ background: theme.accentTint, color: theme.accentDeep }}
              >
                <Check className="h-3 w-3" strokeWidth={2.6} />
              </span>
              <span className="text-[13px] leading-snug text-[var(--color-of-ink)]">{perk}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={onUpgrade} className="mt-6 w-full font-semibold" style={{ background: theme.accent }}>
          Upgrade to {tierName} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SettingsModal({ open, onClose, user, accent, onAccentChange, appearance, onAppearanceChange, onSaved, initialTab, onTabChange, onTakeTour }: SettingsModalProps) {
  const router = useRouter();
  const { connectBank, plan, promptUpgrade, openBillingPortal, portalBusy, theme, resolvedMode } = useOtterfundChrome();
  const [tab, setTab] = useState<SettingsTab>((initialTab as SettingsTab) ?? "profile");
  // Sync to the URL-driven tab whenever the modal opens (or the param changes),
  // so deep links + the "Back to Settings" return from pricing land on the right tab.
  useEffect(() => {
    if (open && initialTab) setTab(initialTab as SettingsTab);
  }, [open, initialTab]);

  // ── Connections (linked banks) ──
  const [connections, setConnections] = useState<PlaidConnection[] | null>(null);
  const [connLoading, setConnLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setConnLoading(true);
    try {
      const { plaidItems } = await gqlClient.request<{ plaidItems: PlaidConnection[] }>(
        PLAID_ITEMS,
      );
      setConnections(plaidItems ?? []);
    } catch {
      setConnections([]);
    } finally {
      setConnLoading(false);
    }
  }, []);

  // ── Messaging (text the advisor via Telegram / WhatsApp) ──
  const [messaging, setMessaging] = useState<MessagingConn[] | null>(null);
  const [linking, setLinking] = useState<MessagingProviderId | null>(null);
  const [msgBusy, setMsgBusy] = useState<string | null>(null);

  const loadMessaging = useCallback(async (): Promise<MessagingConn[]> => {
    try {
      const { messagingConnections } = await gqlClient.request<{ messagingConnections: MessagingConn[] }>(
        MESSAGING_CONNECTIONS,
      );
      const list = messagingConnections ?? [];
      setMessaging(list);
      return list;
    } catch {
      setMessaging([]);
      return [];
    }
  }, []);

  const startMessagingLink = async (provider: MessagingProviderId) => {
    setLinking(provider);
    try {
      const { startMessagingLink: res } = await gqlClient.request<{
        startMessagingLink: { deepLink: string; provider: string };
      }>(START_MESSAGING_LINK, { provider });
      // Open the chat app (or its web client). The user taps Start/Send there; the
      // webhook flips us to "active" and the poll below picks it up.
      if (res?.deepLink) window.open(res.deepLink, "_blank", "noopener,noreferrer");
      else setLinking(null);
    } catch {
      setLinking(null);
    }
  };

  const disconnectMessagingProvider = async (provider: MessagingProviderId) => {
    setMsgBusy(provider);
    try {
      await gqlClient.request(DISCONNECT_MESSAGING, { provider });
      await loadMessaging();
    } finally {
      setMsgBusy(null);
    }
  };

  // While a link is pending, poll until the provider goes active (or give up after
  // ~2 min). router.refresh() picks up the newly-connected state elsewhere too.
  useEffect(() => {
    if (!linking) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      const list = await loadMessaging();
      const active = list.find((m) => m.provider === linking)?.status === "active";
      if (active || tries >= 40) {
        clearInterval(iv);
        setLinking(null);
        if (active) router.refresh();
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [linking, loadMessaging, router]);

  useEffect(() => {
    if (open && tab === "connections") {
      loadConnections();
      loadMessaging();
    }
  }, [open, tab, loadConnections, loadMessaging]);

  const disconnect = async (itemId: string) => {
    setDisconnecting(itemId);
    try {
      await gqlClient.request(UNLINK_PLAID_ITEM, { itemId });
      await loadConnections();
      router.refresh();
    } finally {
      setDisconnecting(null);
    }
  };

  // Connecting/reconnecting opens the Plaid overlay, so close settings first.
  const startConnect = (updateItemId?: string) => {
    onClose();
    connectBank(updateItemId);
  };

  const [name, setName] = useState(user.name);
  const [monthlyIncome, setMonthlyIncome] = useState(String(user.monthlyIncome));
  const [currency, setCurrency] = useState(user.currency);
  const [planId, setPlanId] = useState(user.budgetPlan);
  // Budget target is DERIVED (plan spend % × income), never edited directly. It
  // used to be an editable field, but every plan switch silently recomputed it
  // and nothing besides budget alerts read the manual value, so hand edits only
  // ever looked unsaved. The server re-derives on income change (settings.ts).
  const activePlan = getBudgetPlan(planId);
  const spendPct = activePlan.needs + activePlan.wants;
  const derivedBudgetTarget = Math.round(((Number(monthlyIncome) || 0) * spendPct) / 100);

  // Inline autosave status: fields persist ~800ms after the last edit, so there
  // is no Save button. `nameError` is the only blocking validation (name is
  // required) — it suppresses the save until the field is valid again.
  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [nameError, setNameError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed the form ONCE per open. The values come from the server `user` props,
  // which resolve after first render, so we seed when the modal opens rather
  // than capturing in useState. Crucially this must NOT re-run on every prop
  // change: autosave calls router.refresh(), which feeds fresh `user` props
  // back in — re-seeding then would wipe the live "Saved" status (the flicker)
  // and clobber whatever the user is mid-typing. A ref gates it to the
  // open→close→open transition only.
  const seededRef = useRef(false);
  useEffect(() => {
    if (open && !seededRef.current) {
      seededRef.current = true;
      setName(user.name);
      setMonthlyIncome(String(user.monthlyIncome));
      setCurrency(user.currency);
      setPlanId(user.budgetPlan);
      setSaveStatus("idle");
      setNameError("");
    } else if (!open && seededRef.current) {
      seededRef.current = false;
    }
  }, [open, user.name, user.monthlyIncome, user.currency, user.budgetPlan]);

  // Cancel any pending autosave when the modal unmounts.
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Let the "Saved" confirmation fade back to idle after a couple seconds.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 2200);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // Delete account is a guarded inline confirm: clicking arms "Are you sure?",
  // which reveals a field the user must type the exact phrase into before the
  // destructive action unlocks.
  const DELETE_PHRASE = "Confirm delete";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteUnlocked = confirmText.trim() === DELETE_PHRASE;

  // Data exports go through support by email now. The old self-serve JSON
  // download put the full account record one click away; a drafted email keeps
  // the request deliberate and lets support verify the requester first.
  const requestDataExport = () => {
    const subject = "Personal data export request";
    const body = [
      "Hey,",
      "",
      `Please send me an export of the personal data linked to my account (${user.email}).`,
      "",
      "Thank you!",
    ].join("\n");
    window.location.href = `mailto:${LEGAL.privacyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const disarmDelete = () => {
    setConfirmDelete(false);
    setConfirmText("");
  };

  // Arm on first click; clear the typed phrase as we re-arm.
  const armDelete = () => {
    setConfirmText("");
    setConfirmDelete(true);
  };

  const handleDeleteAccount = () => {
    if (!deleteUnlocked) return;
    setDeleting(true);
    gqlClient
      .request(DELETE_MY_ACCOUNT)
      .then(async () => {
        await createClient().auth.signOut();
        window.location.href = "/login";
      })
      .catch(() => setDeleting(false));
  };

  // Persist the current field values. Returns once the PATCH settles so the
  // status line can reflect the outcome. Refreshes the session only when the
  // name changed (the avatar/topbar read from the session, not the DB).
  const persist = async (values: { name: string; monthlyIncome: string; currency: string }) => {
    const trimmedName = values.name.trim();
    setSaveStatus("saving");
    try {
      await gqlClient.request(UPDATE_SETTINGS, {
        input: {
          name: trimmedName,
          monthlyIncome: Number(values.monthlyIncome) || 0,
          currency: values.currency,
        },
      });
      setSaveStatus("saved");
      router.refresh();
      onSaved?.();
    } catch {
      setSaveStatus("error");
    }
  };

  // Debounce: ~800ms after the last edit, persist — unless the name is blank
  // (the one blocking rule), in which case we surface the error and hold off.
  const scheduleSave = (next: { name: string; monthlyIncome: string; currency: string }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.name.trim()) {
      setNameError("Give yourself a name.");
      setSaveStatus("idle");
      return;
    }
    setNameError("");
    debounceRef.current = setTimeout(() => persist(next), 800);
  };

  const editName = (v: string) => { setName(v); scheduleSave({ name: v, monthlyIncome, currency }); };
  const editIncome = (v: string) => { setMonthlyIncome(v); scheduleSave({ name, monthlyIncome: v, currency }); };
  const editCurrency = (v: string) => { setCurrency(v); scheduleSave({ name, monthlyIncome, currency: v }); };

  // Switching the plan is immediate (not debounced) — it recomputes the spend
  // allowance + this month's category budgets server-side. The derived budget
  // target above re-renders from planId, so no local mirroring is needed.
  const changePlan = async (id: string) => {
    if (id === planId) return;
    const prevPlan = planId;
    // Flush any pending debounced autosave first so it can't land after the
    // plan switch with stale income.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPlanId(id);
    setSaveStatus("saving");
    try {
      // Flush the latest income/currency first so the server (which reads income
      // from the DB) recomputes the plan from the same figures shown here.
      if (name.trim()) {
        await gqlClient.request(UPDATE_SETTINGS, {
          input: { name: name.trim(), monthlyIncome: Number(monthlyIncome) || 0, currency },
        });
      }
      await gqlClient.request(UPDATE_BUDGET_PLAN, { planId: id });
      setSaveStatus("saved");
      router.refresh();
      onSaved?.();
    } catch {
      // Roll the optimistic selection back so the picker matches what's saved.
      setPlanId(prevPlan);
      setSaveStatus("error");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          disarmDelete();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[min(820px,calc(100%-2.5rem))] p-0 gap-0 block overflow-hidden">
        <DialogHeader className="px-8 pt-7 pb-5">
          <DialogTitle className="text-[22px]">Settings</DialogTitle>
        </DialogHeader>

        {/* Woven-ribbon rule — the guilloché divider under the title, in place of
            a plain hairline (the squiggle moved here from the accounts hero). */}
        <svg
          viewBox="0 0 400 12"
          preserveAspectRatio="none"
          aria-hidden
          className="block w-full"
          style={{ height: 8 }}
        >
          <path d={braid(400, 6, 3, 15, 0)} fill="none" stroke={theme.accentDeep} strokeWidth={0.9} opacity={0.4} />
          <path d={braid(400, 6, 3, 15, Math.PI)} fill="none" stroke={theme.accent} strokeWidth={0.9} opacity={0.45} />
        </svg>

        <div className="flex flex-col md:flex-row" style={{ height: "min(620px, 78vh)" }}>
          {/* ── Left rail (desktop) / top dropdown (mobile): tabs. On small
               screens 5 pills won't fit a phone width, so the rail collapses to
               a single pill-styled dropdown; md+ is the vertical rail. ── */}
          <div className="border-b border-[var(--color-of-line-soft)] px-4 py-3 md:w-[196px] md:shrink-0 md:border-b-0 md:border-r md:py-6 md:px-4">
            {(() => {
              const onValueChange = (v: string) => {
                disarmDelete();
                setTab(v as SettingsTab);
                onTabChange?.(v);
              };
              const active = TABS.find((t) => t.value === tab) ?? TABS[0];
              const ActiveIcon = active.icon;
              return (
                <>
                  {/* Mobile: dropdown */}
                  <div className="md:hidden max-w-[260px]">
                    <Menu>
                      <MenuTrigger
                        className="flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-left text-[13.5px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        style={{ background: accent }}
                      >
                        {ActiveIcon && <ActiveIcon className="h-4 w-4 shrink-0" strokeWidth={2.1} />}
                        <span className="min-w-0 flex-1 truncate">{active.label}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                      </MenuTrigger>
                      <MenuContent align="start" className="w-[var(--anchor-width)] min-w-0">
                        <MenuRadioGroup value={tab} onValueChange={onValueChange}>
                          {TABS.map((t) => {
                            const Icon = t.icon;
                            return (
                              <MenuRadioItem key={t.value} value={t.value} closeOnClick>
                                <span className="flex items-center gap-2.5">
                                  {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />}
                                  {t.label}
                                </span>
                                {t.value === tab && <Check className="h-4 w-4 shrink-0 text-[var(--color-of-muted)]" />}
                              </MenuRadioItem>
                            );
                          })}
                        </MenuRadioGroup>
                      </MenuContent>
                    </Menu>
                  </div>
                  {/* Desktop: vertical rail */}
                  <Tabs
                    className="hidden md:flex"
                    items={TABS}
                    value={tab}
                    accent={accent}
                    onValueChange={onValueChange}
                  />
                </>
              );
            })()}
          </div>

          {/* ── Right: active panel — scrolls internally so the dialog footprint
               stays fixed and roomy across every tab. ── */}
          <div className="of-scroll flex-1 overflow-y-auto px-8 py-7">
            {tab === "profile" && (
              <section className="of-enter">
                <SectionHead icon={User} title="Profile" desc={<>How you show up across <Wordmark />.</>} />
                <div className="flex max-w-[420px] flex-col gap-5">
                  <div>
                    <label className={fieldLabelCls}>Name</label>
                    <input
                      value={name}
                      onChange={(e) => editName(e.target.value)}
                      aria-invalid={!!nameError || undefined}
                      className={`of-field ${nameError ? "border-[var(--color-of-clay)] focus:border-[var(--color-of-clay)]" : ""}`}
                    />
                    {nameError && (
                      <p className="mt-1.5 text-[12px] font-medium text-[var(--color-of-clay)]">{nameError}</p>
                    )}
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Email</label>
                    <input value={user.email} disabled className="of-field opacity-60" />
                  </div>
                </div>

                {/* Product tour — replays the first-run walkthrough (moved here
                    from the profile menu). */}
                <div className="mt-7 max-w-[420px] border-t border-[var(--color-of-line-soft)] pt-6">
                  <div className={fieldLabelCls}>Product tour</div>
                  <p className="mb-3 text-[12.5px] text-[var(--color-of-muted)]">
                    Replay the quick walkthrough of where everything lives.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => onTakeTour?.()} disabled={!onTakeTour}>
                    Take a tour
                  </Button>
                </div>
              </section>
            )}

            {tab === "plan" && (
              <section className="of-enter">
                <SectionHead icon={CreditCard} title="Plan" desc={<>Your <Wordmark /> subscription and billing.</>} />
                <div
                  className="max-w-[440px] rounded-2xl p-6"
                  style={{ background: "var(--color-of-surface)", border: "1px solid var(--color-of-line)" }}
                >
                  <div>
                    <div className={fieldLabelCls}>Current plan</div>
                    <div className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.01em] text-[var(--color-of-ink)]">
                      {PLAN_META[plan].name}
                      <PlanBadgeIcon plan={plan} size={18} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {/* Change plan is available on every tier (upgrade or switch);
                        only Manage billing is hidden on free (no subscription yet). */}
                    <Button size="sm" onClick={() => { onClose(); promptUpgrade(); }}>
                      <ArrowLeftRight data-icon="inline-start" className="w-4 h-4" /> Change plan
                    </Button>
                    {plan !== "free" && (
                      // Keep the modal open while the portal session is minted — the
                      // button's spinner is the user's feedback across the hop to Stripe
                      // (the page unloads on success; an error routes to /pricing).
                      <Button variant="outline" size="sm" disabled={portalBusy} onClick={openBillingPortal}>
                        {portalBusy ? (
                          <>
                            <Loader2 data-icon="inline-start" className="w-4 h-4 of-spin" /> Opening…
                          </>
                        ) : (
                          <>
                            <CreditCard data-icon="inline-start" className="w-4 h-4" /> Manage billing
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 max-w-[440px] text-[12.5px] text-[var(--color-of-muted)]">
                  {plan === "free"
                    ? "Upgrade to unlock automatic bank sync, AI insights, and investment tracking."
                    : "Manage billing opens Stripe to update payment, switch plans, or cancel."}
                </p>
              </section>
            )}

            {tab === "money" && (
              <section className="of-enter">
                <SectionHead icon={Wallet} title="Money" desc="Drives net worth, budget, and savings rate." />
                <div className="flex max-w-[420px] flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={fieldLabelCls}>Monthly income</label>
                      <input
                        type="number"
                        value={monthlyIncome}
                        onChange={(e) => editIncome(e.target.value)}
                        className="of-field"
                      />
                    </div>
                    <div>
                      <label className={fieldLabelCls}>Budget target</label>
                      {/* Read-only: derived from the plan, not stored input. */}
                      <div className="of-num flex h-11 items-center px-1 text-[17px] text-[var(--color-of-ink)]">
                        {new Intl.NumberFormat("en-CA", {
                          style: "currency",
                          currency,
                          minimumFractionDigits: 0,
                        }).format(derivedBudgetTarget)}
                        <span className="ml-2 text-[12px] font-medium text-[var(--color-of-faint)]">/mo</span>
                      </div>
                    </div>
                  </div>
                  <p className="-mt-2 text-[12px] leading-relaxed text-[var(--color-of-muted)]">
                    Your budget target is {spendPct}% of income, set by the {activePlan.name} below. Pick a different plan to change it.
                  </p>
                  <div>
                    <label className={fieldLabelCls}>Currency</label>
                    <div className="relative">
                      <select
                        value={currency}
                        onChange={(e) => editCurrency(e.target.value)}
                        className="of-field-select"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-of-muted)]" />
                    </div>
                  </div>
                </div>

                <div className="mt-7 max-w-[540px]">
                  <label className={fieldLabelCls}>Budget plan</label>
                  <BudgetPlanPicker value={planId} onChange={changePlan} accent={accent} mode={resolvedMode} />
                  <p className="mt-2 text-[12px] text-[var(--color-of-muted)]">
                    Splits your income across needs, wants, and savings, and powers the Spending page. Switching recomputes this month&apos;s category budgets.
                  </p>
                </div>
              </section>
            )}

            {tab === "connections" && (
              <section className="of-enter">
                <SectionHead icon={Landmark} title="Connections" desc="Linked banks that sync balances and transactions automatically." />

                {!canUse(plan, "bank_sync") ? (
                  <ConnectionsUpsell theme={theme} onUpgrade={() => { onClose(); promptUpgrade(); }} />
                ) : (
                <>
                {connLoading && connections === null ? (
                  <div className="flex items-center gap-2 text-[13px] text-[var(--color-of-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : connections && connections.length > 0 ? (
                  <div className="overflow-hidden rounded-[20px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)]">
                    {connections.map((c, i) => {
                      const needsFix = c.status === "login_required" || c.status === "error";
                      const statusLabel =
                        c.status === "active" ? "Connected" : c.status === "login_required" ? "Needs reconnect" : "Sync error";
                      const busy = disconnecting === c.itemId;
                      return (
                        <div
                          key={c.itemId}
                          className="flex flex-col gap-3 px-[22px] py-[18px] sm:flex-row sm:items-center sm:gap-[15px]"
                          style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)" }}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-[15px]">
                            {c.domain ? (
                              // Real bank logo (e.g. Scotiabank), same treatment
                              // as accounts/transactions — falls back to a letter
                              // tile if the logo can't load.
                              <MerchantAvatar
                                name={c.institutionName || "Bank"}
                                domain={c.domain}
                                bg="var(--accent)"
                                ink="var(--color-primary)"
                                size={44}
                                fit="contain"
                              />
                            ) : (
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
                                style={{ background: "var(--accent)", color: "var(--color-primary)" }}
                              >
                                <Landmark className="w-[19px] h-[19px]" strokeWidth={1.9} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[14.5px] font-semibold text-[var(--color-of-ink)]">
                                  {c.institutionName || "Bank"}
                                </span>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.02em]"
                                  style={
                                    needsFix
                                      ? { background: "var(--color-of-clay-tint)", color: "var(--color-of-clay)" }
                                      : { background: "var(--accent)", color: "var(--accent-foreground)" }
                                  }
                                >
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="text-[12.5px] text-[var(--color-of-muted)] mt-0.5">
                                {c.accountCount} {c.accountCount === 1 ? "account" : "accounts"}
                                {c.lastSyncedAt
                                  ? ` · Updated ${new Date(c.lastSyncedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`
                                  : ""}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-[15px] self-start sm:self-auto">
                            {needsFix && (
                              <Button size="sm" onClick={() => startConnect(c.itemId)}>
                                <RefreshCw data-icon="inline-start" className="w-3.5 h-3.5" /> Reconnect
                              </Button>
                            )}
                            <ConfirmButton
                              onConfirm={() => disconnect(c.itemId)}
                              icon={Unlink}
                              busyIcon={Loader2}
                              confirmLabel="Are you sure?"
                              busyLabel="Disconnecting…"
                              busy={busy}
                              restText="Disconnect"
                              restTextMobileOnly
                              restWidth="w-[140px]"
                              expandedWidth="w-[172px]"
                              labelMaxWidth="max-w-[128px]"
                              restLabel={`Disconnect ${c.institutionName || "bank"}`}
                              armedLabel={`Confirm disconnect ${c.institutionName || "bank"}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--color-of-muted)] max-w-[420px]">
                    No banks connected yet. Link one to import balances and transactions automatically.
                  </p>
                )}

                <Button size="sm" onClick={() => startConnect()} className="mt-4" variant="outline">
                  <Plus data-icon="inline-start" className="w-4 h-4" /> Connect a bank
                </Button>
                </>
                )}

                {/* ── Message your advisor (Telegram / WhatsApp) ── */}
                <div className="mt-9 border-t border-[var(--color-of-line-soft)] pt-7">
                  <SectionHead
                    icon={Send}
                    title="Message your advisor"
                    desc={<>Text{" "}<Wordmark />{" "}from Telegram or WhatsApp and get answers about your money, no app needed.</>}
                  />

                  {!canUse(plan, "messaging") ? (
                    <ConnectionsUpsell theme={theme} feature="messaging" onUpgrade={() => { onClose(); promptUpgrade(); }} />
                  ) : (
                    <>
                      <div className="overflow-hidden rounded-[20px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)]">
                        {MESSAGING_PROVIDERS_META.map((p, i) => {
                          const conn = messaging?.find((m) => m.provider === p.provider);
                          const status = conn?.status ?? "disconnected";
                          const configured = conn?.configured ?? false;
                          const isActive = status === "active";
                          const isLinking = linking === p.provider;
                          const Icon = p.icon;
                          return (
                            <div
                              key={p.provider}
                              className="flex flex-col gap-3 px-[22px] py-[18px] sm:flex-row sm:items-center sm:gap-[15px]"
                              style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)" }}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-[15px]">
                                <div
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
                                  style={{ background: "var(--accent)", color: "var(--color-primary)" }}
                                >
                                  <Icon className="h-[19px] w-[19px]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-[14.5px] font-semibold text-[var(--color-of-ink)]">
                                      {p.label}
                                    </span>
                                    {isActive && (
                                      <span
                                        className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.02em]"
                                        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                                      >
                                        Connected
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[12.5px] text-[var(--color-of-muted)]">
                                    {isActive
                                      ? `Answers arrive in your ${p.label} chat.`
                                      : isLinking
                                        ? `Waiting for you to tap ${p.startVerb} in ${p.label}…`
                                        : configured
                                          ? p.hint
                                          : "Not available yet, coming soon."}
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-[15px] self-start sm:self-auto">
                                {isActive ? (
                                  <ConfirmButton
                                    onConfirm={() => disconnectMessagingProvider(p.provider)}
                                    icon={Unlink}
                                    busyIcon={Loader2}
                                    confirmLabel="Are you sure?"
                                    busyLabel="Disconnecting…"
                                    busy={msgBusy === p.provider}
                                    restText="Disconnect"
                                    restTextMobileOnly
                                    restWidth="w-[150px]"
                                    expandedWidth="w-[176px]"
                                    labelMaxWidth="max-w-[132px]"
                                    restLabel={`Disconnect ${p.label}`}
                                    armedLabel={`Confirm disconnect ${p.label}`}
                                  />
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!configured || isLinking}
                                    onClick={() => startMessagingLink(p.provider)}
                                  >
                                    {isLinking ? (
                                      <>
                                        <Loader2 data-icon="inline-start" className="h-3.5 w-3.5 animate-spin" /> Waiting…
                                      </>
                                    ) : (
                                      "Connect"
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {linking && (
                        <p className="mt-3 max-w-[440px] text-[12.5px] text-[var(--color-of-muted)]">
                          A new tab opened to {linking === "telegram" ? "Telegram" : "WhatsApp"}. Tap{" "}
                          {linking === "telegram" ? "Start" : "Send"} there, then come back. This page updates on its own.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {tab === "appearance" && (
              <section className="of-enter">
                <SectionHead icon={Palette} title="Appearance" desc="Make it yours: theme and accent." />

                <div className="mb-8">
                  <div className={fieldLabelCls}>Theme</div>
                  <AppearancePicker value={appearance} onChange={onAppearanceChange} accent={accent} />
                </div>

                <div>
                  <div className={fieldLabelCls}>Accent</div>
                  <SchemePicker
                    accent={accent}
                    onAccentChange={onAccentChange}
                    canUsePremium={plan !== "free"}
                  />
                </div>
              </section>
            )}

            {tab === "data" && (
              <div className="of-enter flex flex-col gap-8">
                <section
                  className="rounded-2xl p-6"
                  style={{ background: "var(--color-of-surface)", border: "1px solid var(--color-of-line)" }}
                >
                  <SectionHead icon={Database} title="Your data" desc="Request a copy of your personal data." />
                  <Button variant="outline" size="sm" onClick={requestDataExport}>
                    Request my data
                  </Button>
                  <p className="mt-3 max-w-[420px] text-[12.5px] leading-relaxed text-[var(--color-of-muted)]">
                    This opens an email draft to support. You&rsquo;ll hear back with your export within 2 days.
                  </p>
                </section>

                {/* Danger zone — delete only */}
                <section
                  className="rounded-2xl p-6"
                  style={{ background: "var(--color-of-clay-tint)", border: "1px solid var(--color-of-clay)" }}
                >
                  <SectionHead
                    icon={ShieldAlert}
                    title="Danger zone"
                    desc="Permanently delete your account and all of its data."
                    tone="clay"
                  />
                  {!confirmDelete ? (
                    <Button variant="danger" size="sm" onClick={armDelete} aria-label="Delete account">
                      <Trash2 data-icon="inline-start" className="w-4 h-4 shrink-0" />
                      Delete account
                    </Button>
                  ) : (
                    <div className="of-enter">
                      <p className="text-[13px] font-semibold text-[var(--color-of-clay)]">
                        Are you sure? This permanently deletes your account and can’t be undone.
                      </p>
                      <p className="mt-3 text-[12.5px] text-[var(--color-of-ink)]">
                        Type <span className="font-semibold">{DELETE_PHRASE}</span> to confirm.
                      </p>
                      <input
                        autoFocus
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && deleteUnlocked) handleDeleteAccount();
                          if (e.key === "Escape") disarmDelete();
                        }}
                        placeholder={DELETE_PHRASE}
                        aria-label={`Type "${DELETE_PHRASE}" to confirm`}
                        className="of-field mt-2 max-w-[300px] bg-[var(--color-of-surface)]"
                      />
                      <div className="mt-3 flex items-center gap-2.5">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleDeleteAccount}
                          disabled={!deleteUnlocked || deleting}
                          aria-label="Confirm delete account"
                        >
                          <Trash2 data-icon="inline-start" className="w-4 h-4 shrink-0" />
                          {deleting ? "Deleting…" : "Delete account"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={disarmDelete} disabled={deleting}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Autosave status — quiet inline line. Appearance applies live and
                Data has its own actions, so this shows only on the form tabs. */}
            {(tab === "profile" || tab === "money") && saveStatus !== "idle" && (
              <div className="mt-7 flex items-center gap-1.5 text-[12.5px] font-medium">
                {saveStatus === "saving" && <span className="text-[var(--color-of-faint)]">Saving…</span>}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-[var(--color-primary)]">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                    Saved
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-[var(--color-of-clay)]">Couldn’t save. Check your connection.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
