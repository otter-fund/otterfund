"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/bulga/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GuillochePattern } from "@/components/bulga/guilloche";
import { BRAND_THEME } from "@/components/bulga/theme";
import {
  DollarSign,
  Landmark,
  RefreshCw,
  ClipboardCheck,
  Plus,
  X,
  Upload,
  FileText,
  Loader2,
  Brain,
  PenLine,
  Check,
  ChevronDown,
} from "lucide-react";
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/constants";
import { ConnectBankModal } from "@/components/dashboard/modals/connect-bank-modal";
import { gqlClient, gqlUpload, errMessage } from "@/lib/graphql/client";

const AUTO_ONBOARD = /* GraphQL */ `
  mutation AutoOnboardFromFiles($files: [File!]!, $currency: String, $monthlyIncome: Float) {
    autoOnboardFromFiles(files: $files, currency: $currency, monthlyIncome: $monthlyIncome)
  }
`;

const COMPLETE_ONBOARDING = /* GraphQL */ `
  mutation CompleteOnboarding($input: OnboardingInput!) {
    completeOnboarding(input: $input)
  }
`;

const CONFIRM_IMPORT = /* GraphQL */ `
  mutation ConfirmImport($input: ConfirmImportInput!) {
    confirmImport(input: $input)
  }
`;

const DETECTED_INCOME = /* GraphQL */ `
  query DetectedMonthlyIncome {
    detectedMonthlyIncome
  }
`;

type AccountEntry = { name: string; type: string; balance: string };
type RecurringEntry = { name: string; amount: string; cycle: string; dueDay?: number };
type Mode = "choose" | "manual" | "auto" | "connect";

const MANUAL_STEPS = [
  { label: "Income", icon: DollarSign },
  { label: "Budget", icon: ClipboardCheck },
  { label: "Accounts", icon: Landmark },
  { label: "Recurring", icon: RefreshCw },
  { label: "Review", icon: ClipboardCheck },
];

const AUTO_STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Analyzing", icon: Brain },
  { label: "Review", icon: ClipboardCheck },
];

const CONNECT_STEPS = [
  { label: "Setup", icon: DollarSign },
  { label: "Connect", icon: Landmark },
];

// Full-size fields use the shared system class (one source of truth). The
// compact variant keeps the same look at a smaller scale for dense rows.
const FIELD_CLASS = "bk-field";
const FIELD_SM_CLASS =
  "w-full h-9 rounded-xl border border-[var(--color-bk-line)] bg-[oklch(98%_0.004_90)] px-3 text-sm text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none transition-colors focus:border-[var(--color-primary)]";
const LABEL_CLASS =
  "block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5";
const HEADING_CLASS =
  "text-2xl sm:text-[28px] font-semibold tracking-[-0.02em] leading-[1.05] text-[var(--color-bk-ink)] mb-2";

// On-brand select for the wizard: strips the native OS dropdown and overlays
// the shared chevron, while preserving each call site's own size/padding so
// the dense rows keep their compact scale. `compact` shrinks the chevron + its
// inset for the h-8/h-9 inline rows.
function WizardSelect({
  className = "",
  compact,
  children,
  ...props
}: React.ComponentProps<"select"> & { compact?: boolean }) {
  return (
    <div className={`relative ${className.includes("flex-1") ? "flex-1" : ""}`}>
      <select
        {...props}
        className={`${className} appearance-none ${compact ? "pr-7" : "pr-10"}`}
      >
        {children}
      </select>
      <ChevronDown
        className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-bk-muted)] ${
          compact ? "right-2 w-3.5 h-3.5" : "right-4 w-4 h-4"
        }`}
      />
    </div>
  );
}

export function OnboardingWizard({ userName }: { userName: string }) {
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Manual fields
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [monthlySavings, setMonthlySavings] = useState("");
  const budgetTarget = monthlyIncome && monthlySavings
    ? String(Number(monthlyIncome) - Number(monthlySavings))
    : "";
  const [accounts, setAccounts] = useState<AccountEntry[]>([
    { name: "", type: "Chequing", balance: "" },
  ]);
  const [recurring, setRecurring] = useState<RecurringEntry[]>([
    { name: "", amount: "", cycle: "Monthly" },
  ]);

  // Connect (Plaid) fields
  const [showConnect, setShowConnect] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);
  // True once we've queried the bank for income after linking (regardless of
  // whether any was found) — drives the "detected vs. couldn't detect" copy.
  const [incomeDetected, setIncomeDetected] = useState(false);

  // Auto fields
  const [files, setFiles] = useState<File[]>([]);
  const [autoAnalysis, setAutoAnalysis] = useState<{
    accounts: { name: string; type: string; balance: number }[];
    recurringExpenses: { name: string; amount: number; cycle: string }[];
    monthlyIncome: number;
    monthlySpend: number;
    budgetTarget: number;
    transactions: { name: string; amount: number; date: string; category: string; isRecurring: boolean }[];
    fileCount: number;
    transactionCount: number;
  } | null>(null);

  // --- Helpers ---
  const canAdvance = () => {
    if (mode === "manual") {
      switch (step) {
        case 0: return Number(monthlyIncome) > 0;
        case 1: return Number(monthlySavings) > 0;
        default: return true;
      }
    }
    if (mode === "auto") {
      return step === 0 ? files.length > 0 : true;
    }
    if (mode === "connect") {
      // Income isn't asked here — it's read from the bank after linking.
      return step === 0 ? Number(monthlySavings) > 0 : true;
    }
    return false;
  };

  const addAccount = () => setAccounts([...accounts, { name: "", type: "Chequing", balance: "" }]);
  const removeAccount = (i: number) => setAccounts(accounts.filter((_, idx) => idx !== i));
  const updateAccount = (i: number, field: keyof AccountEntry, value: string) => {
    const updated = [...accounts];
    updated[i] = { ...updated[i], [field]: value };
    setAccounts(updated);
  };
  const addRecurring = () => setRecurring([...recurring, { name: "", amount: "", cycle: "Monthly" }]);
  const removeRecurring = (i: number) => setRecurring(recurring.filter((_, idx) => idx !== i));
  const updateRecurring = (i: number, field: keyof RecurringEntry, value: string) => {
    const updated = [...recurring];
    updated[i] = { ...updated[i], [field]: value };
    setRecurring(updated);
  };

  const fmtCurrency = (value: string | number) => {
    const num = Number(value);
    if (!num) return "$0";
    return new Intl.NumberFormat("en-CA", { style: "currency", currency, minimumFractionDigits: 0 }).format(num);
  };

  // --- Auto: upload & analyze ---
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const handleAutoAnalyze = async () => {
    setStep(1); // "Analyzing" step
    setError("");

    try {
      const { autoOnboardFromFiles: data } = await gqlUpload(
        AUTO_ONBOARD,
        { files: files.map(() => null), currency },
        files.map((file, i) => ({ path: `variables.files.${i}`, file })),
      );
      setAutoAnalysis(data.analysis);

      // Pre-fill editable fields from analysis
      setMonthlyIncome(String(data.analysis.monthlyIncome));
      const estSavings = data.analysis.monthlyIncome - data.analysis.budgetTarget;
      setMonthlySavings(String(Math.max(0, Math.round(estSavings))));
      setAccounts(
        data.analysis.accounts.length > 0
          ? data.analysis.accounts.map((a: { name: string; type: string; balance: number }) => ({
              name: a.name,
              type: ACCOUNT_TYPES.find((t) => t.toLowerCase().replace(" ", "-") === a.type) || "Other",
              balance: String(a.balance),
            }))
          : [{ name: "", type: "Chequing", balance: "" }]
      );
      setRecurring(
        data.analysis.recurringExpenses.length > 0
          ? data.analysis.recurringExpenses.map((r: { name: string; amount: number; cycle: string; dueDay?: number }) => ({
              name: r.name,
              amount: String(r.amount),
              cycle: r.cycle,
              dueDay: r.dueDay,
            }))
          : [{ name: "", amount: "", cycle: "Monthly" }]
      );

      setStep(2); // "Review" step
    } catch (e) {
      setError(errMessage(e));
      setStep(0);
    }
  };

  // --- Submit (shared for both modes) ---
  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const validAccounts = accounts.filter((a) => a.name && a.balance);
      const validRecurring = recurring.filter((r) => r.name && r.amount);

      await gqlClient.request(COMPLETE_ONBOARDING, {
        input: {
          monthlyIncome: Number(monthlyIncome),
          currency,
          // Never negative — detected income can come in under the savings goal.
          budgetTarget: Math.max(0, Number(budgetTarget) || 0),
          accounts: validAccounts.map((a) => ({
            name: a.name,
            type: a.type.toLowerCase().replace(" ", "-"),
            balance: Number(a.balance),
          })),
          recurringExpenses: validRecurring.map((r) => ({
            name: r.name,
            amount: Number(r.amount),
            cycle: r.cycle,
            dueDay: r.dueDay,
          })),
        },
      });

      // If auto mode, also import the transactions
      if (mode === "auto" && autoAnalysis?.transactions?.length) {
        await gqlClient.request(CONFIRM_IMPORT, {
          input: {
            statementId: null,
            transactions: autoAnalysis.transactions.map((t) => ({
              name: t.name,
              amount: t.amount,
              date: t.date,
            })),
          },
        });
      }

      window.location.href = "/dashboard";
    } catch (e) {
      setError(errMessage(e));
      setLoading(false);
    }
  };

  // --- Mode chooser ---
  if (mode === "choose") {
    return (
      <>
        <Card className="relative overflow-hidden p-8">
          <GuillochePattern accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} fade="radial" opacity={0.14} />
          <div className="relative">
          <h2 className={HEADING_CLASS}>Welcome, {userName.split(" ")[0]}!</h2>
          <p className="text-sm text-[var(--color-bk-muted)] mb-6">How would you like to set up your budget?</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setMode("connect")}
              className="flex flex-col items-center gap-3 p-7 rounded-2xl border border-[var(--color-bk-line)] bg-[oklch(98%_0.004_90)] hover:border-[var(--color-primary)] transition-colors text-center group"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Landmark className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">Connect a bank</div>
                <div className="text-[11px] text-[var(--color-bk-muted)] mt-1 leading-relaxed">
                  Link your bank to sync accounts &amp; transactions automatically
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("auto")}
              className="flex flex-col items-center gap-3 p-7 rounded-2xl border border-[var(--color-bk-line)] bg-[oklch(98%_0.004_90)] hover:border-[var(--color-primary)] transition-colors text-center group"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--color-sage-light)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">Upload statements</div>
                <div className="text-[11px] text-[var(--color-bk-muted)] mt-1 leading-relaxed">
                  Upload PDF or CSV statements &mdash; AI extracts your accounts &amp; expenses
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("manual")}
              className="flex flex-col items-center gap-3 p-7 rounded-2xl border border-[var(--color-bk-line)] bg-[oklch(98%_0.004_90)] hover:border-[var(--color-primary)] transition-colors text-center group"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--color-slate-light)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <PenLine className="w-6 h-6 text-[var(--color-slate-brand)]" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">Manual</div>
                <div className="text-[11px] text-[var(--color-bk-muted)] mt-1 leading-relaxed">
                  Enter your income, accounts, and expenses by hand
                </div>
              </div>
            </button>
          </div>
          </div>
        </Card>
      </>
    );
  }

  // --- Determine steps based on mode ---
  const steps = mode === "manual" ? MANUAL_STEPS : mode === "connect" ? CONNECT_STEPS : AUTO_STEPS;
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  return (
    <>
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8 sm:mb-10">
        <button
          onClick={() => { setMode("choose"); setStep(0); }}
          className="text-xs text-[var(--color-bk-muted)] hover:text-[var(--color-bk-ink)] mr-2"
        >
          ← Change mode
        </button>
        {steps.map((s, i) => (
          <button
            key={s.label}
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              i === step
                ? "bg-[var(--color-primary)] text-white"
                : i < step
                ? "text-[var(--color-primary)] cursor-pointer"
                : "text-[var(--color-bk-muted)]"
            }`}
          >
            <s.icon className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div>

      <Card className="relative overflow-hidden p-8">
        <GuillochePattern accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} fade="left" opacity={0.13} />
        <div className="relative">
        {/* ====== MANUAL MODE ====== */}
        {mode === "manual" && (
          <>
            {/* Step 1: Income */}
            {step === 0 && (
              <div className="space-y-6 sm:space-y-7" key="income">
                <div>
                  <h2 className={HEADING_CLASS}>Monthly Income</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">What&apos;s your monthly take-home income?</p>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Monthly Income</label>
                  <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="5000" min="0" step="100" className={FIELD_CLASS} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Currency</label>
                  <WizardSelect value={currency} onChange={(e) => setCurrency(e.target.value)} className={`w-full ${FIELD_CLASS}`}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </WizardSelect>
                </div>
              </div>
            )}

            {/* Step 2: Budget */}
            {step === 1 && (
              <div className="space-y-6 sm:space-y-7" key="budget">
                <div>
                  <h2 className={HEADING_CLASS}>Savings Goal</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">How much do you want to save each month?</p>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Monthly Savings</label>
                  <Input type="number" value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)} placeholder={monthlyIncome ? String(Math.round(Number(monthlyIncome) * 0.2)) : "1000"} min="0" step="100" className={FIELD_CLASS} />
                  {monthlyIncome && Number(monthlySavings) > 0 && (
                    <p className="text-xs text-[var(--color-bk-muted)] mt-1.5">
                      That&apos;s {Math.round((Number(monthlySavings) / Number(monthlyIncome)) * 100)}% of your income — leaving {fmtCurrency(Number(monthlyIncome) - Number(monthlySavings))}/mo to spend
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Accounts */}
            {step === 2 && (
              <div className="space-y-6 sm:space-y-7" key="accounts">
                <div>
                  <h2 className={HEADING_CLASS}>Your Accounts</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">Add your bank accounts and credit cards.</p>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto bk-scroll pr-1">
                  {accounts.map((acc, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
                      <div className="flex-1 space-y-2">
                        <Input value={acc.name} onChange={(e) => updateAccount(i, "name", e.target.value)} placeholder="Account name" className="h-9 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-3 text-sm text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        <div className="flex gap-2">
                          <WizardSelect compact value={acc.type} onChange={(e) => updateAccount(i, "type", e.target.value)} className="flex-1 h-9 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-3 text-sm text-[var(--color-bk-ink)] outline-none focus:border-[var(--color-primary)]">
                            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </WizardSelect>
                          <Input type="number" value={acc.balance} onChange={(e) => updateAccount(i, "balance", e.target.value)} placeholder="Balance" className="flex-1 h-9 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-3 text-sm text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        </div>
                      </div>
                      {accounts.length > 1 && (
                        <button onClick={() => removeAccount(i)} className="mt-1 text-[var(--color-bk-muted)] hover:text-[var(--color-bk-clay)] transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addAccount} className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] font-semibold hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add another account
                </button>
              </div>
            )}

            {/* Step 4: Recurring */}
            {step === 3 && (
              <div className="space-y-6 sm:space-y-7" key="recurring">
                <div>
                  <h2 className={HEADING_CLASS}>Recurring Expenses</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">Add known recurring expenses like rent, subscriptions, and insurance.</p>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto bk-scroll pr-1">
                  {recurring.map((rec, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
                      <div className="flex-1 space-y-2">
                        <Input value={rec.name} onChange={(e) => updateRecurring(i, "name", e.target.value)} placeholder="e.g. Rent, Netflix" className="h-9 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-3 text-sm text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        <div className="flex gap-2">
                          <Input type="number" value={rec.amount} onChange={(e) => updateRecurring(i, "amount", e.target.value)} placeholder="Amount" className="flex-1 h-9 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-3 text-sm text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                          <WizardSelect compact value={rec.cycle} onChange={(e) => updateRecurring(i, "cycle", e.target.value)} className="flex-1 h-9 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-3 text-sm text-[var(--color-bk-ink)] outline-none focus:border-[var(--color-primary)]">
                            <option value="Monthly">Monthly</option>
                            <option value="Annual">Annual</option>
                            <option value="Weekly">Weekly</option>
                          </WizardSelect>
                        </div>
                      </div>
                      {recurring.length > 1 && (
                        <button onClick={() => removeRecurring(i)} className="mt-1 text-[var(--color-bk-muted)] hover:text-[var(--color-bk-clay)] transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addRecurring} className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] font-semibold hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add another expense
                </button>
              </div>
            )}

            {/* Step 5: Review (manual) */}
            {step === 4 && (
              <ReviewStep
                monthlyIncome={monthlyIncome}
                monthlySavings={monthlySavings}
                budgetTarget={budgetTarget}
                currency={currency}
                accounts={accounts}
                recurring={recurring}
                fmtCurrency={fmtCurrency}
                error={error}
              />
            )}
          </>
        )}

        {/* ====== CONNECT (Plaid) MODE ====== */}
        {mode === "connect" && (
          <>
            {/* Step 1: Setup (savings goal + currency — income comes from the bank) */}
            {step === 0 && (
              <div className="space-y-6 sm:space-y-7" key="connect-setup">
                <div>
                  <h2 className={HEADING_CLASS}>A few basics</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">Set your savings goal and currency — we&apos;ll read your income straight from your bank.</p>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Monthly Savings</label>
                  <Input type="number" value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)} placeholder="1000" min="0" step="100" className={FIELD_CLASS} />
                  <p className="text-xs text-[var(--color-bk-muted)] mt-1.5">
                    How much you want to set aside each month. We&apos;ll subtract this from your income to set your spending budget.
                  </p>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Currency</label>
                  <WizardSelect value={currency} onChange={(e) => setCurrency(e.target.value)} className={`w-full ${FIELD_CLASS}`}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </WizardSelect>
                </div>
              </div>
            )}

            {/* Step 2: Connect the bank */}
            {step === 1 && (
              <div className="space-y-6 sm:space-y-7" key="connect-link">
                <div>
                  <h2 className={HEADING_CLASS}>Connect your bank</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">Securely link your bank through Plaid. We&apos;ll import your accounts and recent transactions, then keep them in sync.</p>
                </div>

                {bankConnected ? (
                  <>
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--color-bk-line)] bg-[var(--accent)]">
                      <Check className="w-5 h-5 text-[var(--color-primary)]" />
                      <div className="text-sm font-semibold text-[var(--color-bk-ink)]">Bank connected — your accounts are importing.</div>
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Detected monthly income</label>
                      <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0" min="0" step="100" className={FIELD_CLASS} />
                      <p className="text-xs text-[var(--color-bk-muted)] mt-1.5">
                        {Number(monthlyIncome) > 0
                          ? "Estimated from the deposits we just imported — edit it if it looks off."
                          : incomeDetected
                            ? "We couldn't detect income from your deposits yet. Enter it here, or adjust later in Settings."
                            : "Reading your deposits…"}
                      </p>
                    </div>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setShowConnect(true)} className="w-full">
                    <Landmark data-icon="inline-start" className="w-4 h-4" /> Connect a bank
                  </Button>
                )}

                <p className="text-xs text-[var(--color-bk-muted)]">
                  Prefer to do this later? You can connect anytime from Settings → Connections. Click “Get Started” below to finish.
                </p>
              </div>
            )}
          </>
        )}

        {/* ====== AUTO MODE ====== */}
        {mode === "auto" && (
          <>
            {/* Step 1: Upload */}
            {step === 0 && (
              <div className="space-y-6 sm:space-y-7" key="upload">
                <div>
                  <h2 className={HEADING_CLASS}>Upload Statements</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">
                    Drop your bank statements (CSV or PDF). Upload as many as you like — AI will extract accounts, recurring expenses, and categorize transactions.
                  </p>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Currency</label>
                  <WizardSelect value={currency} onChange={(e) => setCurrency(e.target.value)} className={`w-full ${FIELD_CLASS}`}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </WizardSelect>
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border border-dashed border-[var(--color-bk-line)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                  onClick={() => document.getElementById("auto-file-input")?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto text-[var(--color-bk-muted)] mb-3" />
                  <p className="text-sm font-semibold text-[var(--color-bk-ink)]">Drop CSV or PDF files here</p>
                  <p className="text-xs text-[var(--color-bk-muted)] mt-1">or click to browse — upload multiple files</p>
                  <input
                    id="auto-file-input"
                    type="file"
                    accept=".csv,.pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
                        <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                        <span className="text-sm flex-1 truncate text-[var(--color-bk-ink)]">{f.name}</span>
                        <span className="text-xs text-[var(--color-bk-muted)]">{(f.size / 1024).toFixed(1)} KB</span>
                        <button onClick={() => removeFile(i)} className="text-[var(--color-bk-muted)] hover:text-[var(--color-bk-clay)]">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {error && <p className="text-sm text-[var(--color-bk-clay)] font-medium">{error}</p>}
              </div>
            )}

            {/* Step 2: Analyzing */}
            {step === 1 && (
              <div className="flex flex-col items-center justify-center py-12" key="analyzing">
                <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin mb-4" />
                <h2 className={`${HEADING_CLASS} text-center`}>Analyzing your statements...</h2>
                <p className="text-sm text-[var(--color-bk-muted)] text-center max-w-sm">
                  AI is reading {files.length} file{files.length > 1 ? "s" : ""} to extract your accounts, recurring expenses, income, and transactions. This may take a minute.
                </p>
              </div>
            )}

            {/* Step 3: Review (auto) */}
            {step === 2 && autoAnalysis && (
              <div className="space-y-6 sm:space-y-7" key="auto-review">
                <div>
                  <h2 className={HEADING_CLASS}>Here&apos;s what we found</h2>
                  <p className="text-sm text-[var(--color-bk-muted)]">
                    <Check className="w-3.5 h-3.5 inline text-[var(--color-primary)] mr-1" />
                    {autoAnalysis.transactionCount} transactions from {autoAnalysis.fileCount} file{autoAnalysis.fileCount > 1 ? "s" : ""}. Review and edit below.
                  </p>
                </div>

                {/* Editable income & budget */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Monthly Income</label>
                    <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className={FIELD_SM_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Monthly Savings</label>
                    <Input type="number" value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)} className={FIELD_SM_CLASS} />
                  </div>
                </div>

                {/* Accounts */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-2">
                    Accounts ({accounts.filter((a) => a.name).length})
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto bk-scroll pr-1">
                    {accounts.map((acc, i) => (
                      <div key={i} className="flex gap-2 items-center p-2.5 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
                        <Input value={acc.name} onChange={(e) => updateAccount(i, "name", e.target.value)} className="flex-1 h-8 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-2.5 text-xs text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        <WizardSelect compact value={acc.type} onChange={(e) => updateAccount(i, "type", e.target.value)} className="h-8 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-1.5 text-xs text-[var(--color-bk-ink)] outline-none focus:border-[var(--color-primary)]">
                          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </WizardSelect>
                        <Input type="number" value={acc.balance} onChange={(e) => updateAccount(i, "balance", e.target.value)} placeholder="Balance" className="w-24 h-8 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-2.5 text-xs text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        {accounts.length > 1 && (
                          <button onClick={() => removeAccount(i)} className="text-[var(--color-bk-muted)] hover:text-[var(--color-bk-clay)]"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={addAccount} className="flex items-center gap-1 text-xs text-[var(--color-primary)] font-semibold hover:underline mt-1.5">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {/* Recurring */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-2">
                    Recurring Expenses ({recurring.filter((r) => r.name).length})
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto bk-scroll pr-1">
                    {recurring.map((rec, i) => (
                      <div key={i} className="flex gap-2 items-center p-2.5 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
                        <Input value={rec.name} onChange={(e) => updateRecurring(i, "name", e.target.value)} className="flex-1 h-8 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-2.5 text-xs text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        <Input type="number" value={rec.amount} onChange={(e) => updateRecurring(i, "amount", e.target.value)} placeholder="$" className="w-20 h-8 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-2.5 text-xs text-[var(--color-bk-ink)] placeholder:text-[var(--color-bk-faint)] outline-none focus:border-[var(--color-primary)]" />
                        <WizardSelect compact value={rec.cycle} onChange={(e) => updateRecurring(i, "cycle", e.target.value)} className="h-8 rounded-lg border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] px-1.5 text-xs text-[var(--color-bk-ink)] outline-none focus:border-[var(--color-primary)]">
                          <option value="Monthly">Monthly</option>
                          <option value="Annual">Annual</option>
                          <option value="Weekly">Weekly</option>
                        </WizardSelect>
                        {recurring.length > 1 && (
                          <button onClick={() => removeRecurring(i)} className="text-[var(--color-bk-muted)] hover:text-[var(--color-bk-clay)]"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={addRecurring} className="flex items-center gap-1 text-xs text-[var(--color-primary)] font-semibold hover:underline mt-1.5">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {error && <p className="text-sm text-[var(--color-bk-clay)] font-medium">{error}</p>}
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 gap-3">
          {step > 0 && !(mode === "auto" && step === 1) ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} className="px-6 text-[var(--color-bk-muted)]">
              Back
            </Button>
          ) : (
            <div />
          )}

          {mode === "auto" && step === 0 ? (
            <Button size="sm" onClick={handleAutoAnalyze} disabled={files.length === 0} className="px-6">
              <Brain data-icon="inline-start" className="w-4 h-4" />
              Analyze {files.length} file{files.length !== 1 ? "s" : ""}
            </Button>
          ) : mode === "auto" && step === 1 ? (
            <div />
          ) : !isLastStep ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canAdvance()} className="px-6">
              Continue
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={loading} className="px-6">
              {loading ? "Setting up..." : "Get Started"}
            </Button>
          )}
        </div>
        </div>
      </Card>

      <ConnectBankModal
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onLinked={async () => {
          setBankConnected(true);
          setShowConnect(false);
          // The initial Plaid sync runs before onLinked fires, so the imported
          // transactions are already queryable. Pre-fill the income figure.
          try {
            const { detectedMonthlyIncome } = await gqlClient.request<{
              detectedMonthlyIncome: number | null;
            }>(DETECTED_INCOME);
            if (detectedMonthlyIncome && detectedMonthlyIncome > 0) {
              setMonthlyIncome(String(Math.round(detectedMonthlyIncome)));
            }
          } catch {
            // Leave the field for the user to fill in manually.
          } finally {
            setIncomeDetected(true);
          }
        }}
      />
    </>
  );
}

// --- Review step (shared UI) ---
function ReviewStep({
  monthlyIncome, monthlySavings, budgetTarget, currency, accounts, recurring, fmtCurrency, error,
}: {
  monthlyIncome: string; monthlySavings: string; budgetTarget: string; currency: string;
  accounts: AccountEntry[]; recurring: RecurringEntry[];
  fmtCurrency: (v: string | number) => string; error: string;
}) {
  return (
    <div className="space-y-6 sm:space-y-7" key="review">
      <div>
        <h2 className={HEADING_CLASS}>Looking Good!</h2>
        <p className="text-sm text-[var(--color-bk-muted)]">Here&apos;s a summary. You can go back to edit anything.</p>
      </div>
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
          <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1">Monthly Income</div>
          <div className="bk-num text-lg text-[var(--color-bk-ink)]">{fmtCurrency(monthlyIncome)} {currency}</div>
        </div>
        <div className="p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
          <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1">Monthly Savings</div>
          <div className="bk-num text-lg text-[var(--color-bk-ink)]">{fmtCurrency(monthlySavings)}/mo <span className="text-sm text-[var(--color-bk-muted)] font-sans font-normal">({Math.round((Number(monthlySavings) / Number(monthlyIncome)) * 100) || 0}% of income)</span></div>
        </div>
        <div className="p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
          <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1">Spending Budget</div>
          <div className="bk-num text-lg text-[var(--color-bk-ink)]">{fmtCurrency(budgetTarget)}/mo</div>
        </div>
        {accounts.some((a) => a.name) && (
          <div className="p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
            <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1">Accounts ({accounts.filter((a) => a.name).length})</div>
            {accounts.filter((a) => a.name).map((a, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5 text-[var(--color-bk-ink)]">
                <span>{a.name} <span className="text-[var(--color-bk-muted)]">· {a.type}</span></span>
                <span className="font-medium">{fmtCurrency(a.balance)}</span>
              </div>
            ))}
          </div>
        )}
        {recurring.some((r) => r.name) && (
          <div className="p-3 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]">
            <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1">Recurring Expenses ({recurring.filter((r) => r.name).length})</div>
            {recurring.filter((r) => r.name).map((r, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5 text-[var(--color-bk-ink)]">
                <span>{r.name} <span className="text-[var(--color-bk-muted)]">· {r.cycle}</span></span>
                <span className="font-medium">{fmtCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-[var(--color-bk-clay)] font-medium">{error}</p>}
    </div>
  );
}
