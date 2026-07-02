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
import { Tabs, type TabItem } from "@/components/bulga/tabs";
import { Menu, MenuTrigger, MenuContent, MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";
import { SchemePicker } from "@/components/bulga/scheme-picker";
import { braid } from "@/components/bulga/guilloche";
import { deriveTheme } from "@/components/bulga/theme";
import { ConfirmButton } from "@/components/bulga/confirm-button";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import { createClient } from "@/lib/supabase/client";
import { gqlClient } from "@/lib/graphql/client";
import { User, Wallet, ShieldAlert, ChevronDown, Database, Palette, Trash2, Check, Landmark, Unlink, RefreshCw, Loader2, Plus } from "lucide-react";
import { CURRENCIES } from "@/lib/constants";

const PLAID_ITEMS = /* GraphQL */ `
  query PlaidItems {
    plaidItems {
      itemId
      institutionName
      status
      lastSyncedAt
      accountCount
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

const DELETE_MY_ACCOUNT = /* GraphQL */ `
  mutation DeleteMyAccount {
    deleteMyAccount { ok }
  }
`;

type SettingsTab = "profile" | "money" | "connections" | "appearance" | "data";

const TABS: TabItem[] = [
  { value: "profile", label: "Profile", icon: User },
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
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    monthlyIncome: number;
    currency: string;
    budgetTarget: number;
  };
  /** Active accent + setter — the Appearance tab hosts the theme picker. */
  accent: string;
  onAccentChange: (accent: string) => void;
  onSaved?: () => void;
}

const fieldLabelCls =
  "block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5";

function SectionHead({
  icon: Icon,
  title,
  desc,
  tone = "accent",
}: {
  icon: typeof User;
  title: string;
  desc: string;
  tone?: "accent" | "clay";
}) {
  const tint = tone === "clay" ? "var(--color-bk-clay-tint)" : "var(--accent)";
  const ink = tone === "clay" ? "var(--color-bk-clay)" : "var(--color-primary)";
  return (
    <div className="flex items-start gap-3 mb-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: tint, color: ink }}
      >
        <Icon className="w-[17px] h-[17px]" strokeWidth={1.9} />
      </div>
      <div>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-bk-ink)] leading-tight">
          {title}
        </h3>
        <p className="text-[12.5px] text-[var(--color-bk-muted)] mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export function SettingsModal({ open, onClose, user, accent, onAccentChange, onSaved }: SettingsModalProps) {
  const router = useRouter();
  const { connectBank } = useBulgaChrome();
  const theme = deriveTheme(accent);
  const [tab, setTab] = useState<SettingsTab>("profile");

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

  useEffect(() => {
    if (open && tab === "connections") loadConnections();
  }, [open, tab, loadConnections]);

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
  const [budgetTarget, setBudgetTarget] = useState(String(user.budgetTarget));

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
      setBudgetTarget(String(user.budgetTarget));
      setSaveStatus("idle");
      setNameError("");
    } else if (!open && seededRef.current) {
      seededRef.current = false;
    }
  }, [open, user.name, user.monthlyIncome, user.currency, user.budgetTarget]);

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
  const persist = async (values: { name: string; monthlyIncome: string; currency: string; budgetTarget: string }) => {
    const trimmedName = values.name.trim();
    setSaveStatus("saving");
    try {
      await gqlClient.request(UPDATE_SETTINGS, {
        input: {
          name: trimmedName,
          monthlyIncome: Number(values.monthlyIncome) || 0,
          currency: values.currency,
          budgetTarget: Number(values.budgetTarget) || 0,
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
  const scheduleSave = (next: { name: string; monthlyIncome: string; currency: string; budgetTarget: string }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.name.trim()) {
      setNameError("Give yourself a name.");
      setSaveStatus("idle");
      return;
    }
    setNameError("");
    debounceRef.current = setTimeout(() => persist(next), 800);
  };

  const editName = (v: string) => { setName(v); scheduleSave({ name: v, monthlyIncome, currency, budgetTarget }); };
  const editIncome = (v: string) => { setMonthlyIncome(v); scheduleSave({ name, monthlyIncome: v, currency, budgetTarget }); };
  const editCurrency = (v: string) => { setCurrency(v); scheduleSave({ name, monthlyIncome, currency: v, budgetTarget }); };
  const editBudget = (v: string) => { setBudgetTarget(v); scheduleSave({ name, monthlyIncome, currency, budgetTarget: v }); };

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
          <div className="border-b border-[var(--color-bk-line-soft)] px-4 py-3 md:w-[196px] md:shrink-0 md:border-b-0 md:border-r md:py-6 md:px-4">
            {(() => {
              const onValueChange = (v: string) => {
                disarmDelete();
                setTab(v as SettingsTab);
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
                                {t.value === tab && <Check className="h-4 w-4 shrink-0 text-[var(--color-bk-muted)]" />}
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
          <div className="bk-scroll flex-1 overflow-y-auto px-8 py-7">
            {tab === "profile" && (
              <section className="bk-enter">
                <SectionHead icon={User} title="Profile" desc="How you show up across Bulga." />
                <div className="flex max-w-[420px] flex-col gap-5">
                  <div>
                    <label className={fieldLabelCls}>Name</label>
                    <input
                      value={name}
                      onChange={(e) => editName(e.target.value)}
                      aria-invalid={!!nameError || undefined}
                      className={`bk-field ${nameError ? "border-[var(--color-bk-clay)] focus:border-[var(--color-bk-clay)]" : ""}`}
                    />
                    {nameError && (
                      <p className="mt-1.5 text-[12px] font-medium text-[var(--color-bk-clay)]">{nameError}</p>
                    )}
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Email</label>
                    <input value={user.email} disabled className="bk-field opacity-60" />
                  </div>
                </div>
              </section>
            )}

            {tab === "money" && (
              <section className="bk-enter">
                <SectionHead icon={Wallet} title="Money" desc="Drives net worth, budget, and savings rate." />
                <div className="flex max-w-[420px] flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={fieldLabelCls}>Monthly income</label>
                      <input
                        type="number"
                        value={monthlyIncome}
                        onChange={(e) => editIncome(e.target.value)}
                        className="bk-field"
                      />
                    </div>
                    <div>
                      <label className={fieldLabelCls}>Budget target</label>
                      <input
                        type="number"
                        value={budgetTarget}
                        onChange={(e) => editBudget(e.target.value)}
                        className="bk-field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Currency</label>
                    <div className="relative">
                      <select
                        value={currency}
                        onChange={(e) => editCurrency(e.target.value)}
                        className="bk-field-select"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-bk-muted)]" />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "connections" && (
              <section className="bk-enter">
                <SectionHead icon={Landmark} title="Connections" desc="Linked banks that sync balances and transactions automatically." />

                {connLoading && connections === null ? (
                  <div className="flex items-center gap-2 text-[13px] text-[var(--color-bk-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : connections && connections.length > 0 ? (
                  <div className="overflow-hidden rounded-[20px] border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)]">
                    {connections.map((c, i) => {
                      const needsFix = c.status === "login_required" || c.status === "error";
                      const statusLabel =
                        c.status === "active" ? "Connected" : c.status === "login_required" ? "Needs reconnect" : "Sync error";
                      const busy = disconnecting === c.itemId;
                      return (
                        <div
                          key={c.itemId}
                          className="flex flex-col gap-3 px-[22px] py-[18px] sm:flex-row sm:items-center sm:gap-[15px]"
                          style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-bk-line-soft)" }}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-[15px]">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
                              style={{ background: "var(--accent)", color: "var(--color-primary)" }}
                            >
                              <Landmark className="w-[19px] h-[19px]" strokeWidth={1.9} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[14.5px] font-semibold text-[var(--color-bk-ink)]">
                                  {c.institutionName || "Bank"}
                                </span>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.02em]"
                                  style={
                                    needsFix
                                      ? { background: "var(--color-bk-clay-tint)", color: "var(--color-bk-clay)" }
                                      : { background: "var(--accent)", color: "var(--accent-foreground)" }
                                  }
                                >
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="text-[12.5px] text-[var(--color-bk-muted)] mt-0.5">
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
                              restText="Unlink"
                              restTextMobileOnly
                              restWidth="w-[122px]"
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
                  <p className="text-[13px] text-[var(--color-bk-muted)] max-w-[420px]">
                    No banks connected yet. Link one to import balances and transactions automatically.
                  </p>
                )}

                <Button size="sm" onClick={() => startConnect()} className="mt-4" variant="outline">
                  <Plus data-icon="inline-start" className="w-4 h-4" /> Connect a bank
                </Button>
              </section>
            )}

            {tab === "appearance" && (
              <section className="bk-enter">
                <SectionHead icon={Palette} title="Appearance" desc="Choose an accent color." />
                <SchemePicker accent={accent} onAccentChange={onAccentChange} />
              </section>
            )}

            {tab === "data" && (
              <div className="bk-enter flex flex-col gap-8">
                <section
                  className="rounded-2xl p-6"
                  style={{ background: "var(--color-bk-surface)", border: "1px solid var(--color-bk-line)" }}
                >
                  <SectionHead icon={Database} title="Your data" desc="Export all of your user data." />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const res = await fetch("/api/settings/export");
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "bulga-export.json";
                        a.click();
                      }
                    }}
                  >
                    Export data
                  </Button>
                </section>

                {/* Danger zone — delete only */}
                <section
                  className="rounded-2xl p-6"
                  style={{ background: "var(--color-bk-clay-tint)", border: "1px solid var(--color-bk-clay)" }}
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
                    <div className="bk-enter">
                      <p className="text-[13px] font-semibold text-[var(--color-bk-clay)]">
                        Are you sure? This permanently deletes your account and can’t be undone.
                      </p>
                      <p className="mt-3 text-[12.5px] text-[var(--color-bk-ink)]">
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
                        className="bk-field mt-2 max-w-[300px] bg-[var(--color-bk-surface)]"
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
                {saveStatus === "saving" && <span className="text-[var(--color-bk-faint)]">Saving…</span>}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-[var(--color-primary)]">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                    Saved
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-[var(--color-bk-clay)]">Couldn’t save — check your connection.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
