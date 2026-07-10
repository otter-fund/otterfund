"use client";

// Shared Investment form — used identically by Add and Edit so the two modals
// stay in lockstep (mirrors subscription-form.tsx). Owns the field layout, the
// account fetch, per-field validation, and the security search.
//
// Search-first: type a NAME or ticker ("Apple", "VFV", "Bitcoin") and a dropdown
// of matching securities appears (name · ticker · exchange, with a logo when
// known). Pick one and we drop in the ticker, fetch its live price, and you only
// enter how many shares you hold — the value is computed for you. A security we
// can't find (or a holding with no ticker at all — real estate, a bond) falls
// back to manual entry: name + asset class + current value. The parent owns
// submit/delete + API calls and the values/errors state; this component writes
// the chosen data back into `values`, so the parent's submit contract is
// unchanged.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Field, TextInput, SelectInput } from "@/components/otterfund/form";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { ASSET_CLASSES } from "@/lib/constants";
import { fmt } from "@/lib/format";
import { gqlClient } from "@/lib/graphql/client";

const ACCOUNTS = /* GraphQL */ `query Accounts { accounts { id name type } }`;

const SEARCH_SECURITIES = /* GraphQL */ `
  query SearchSecurities($query: String!) {
    searchSecurities(query: $query) {
      symbol
      name
      assetClass
      exchange
      domain
    }
  }
`;

const RESOLVE_TICKER = /* GraphQL */ `
  query ResolveTicker($symbol: String!) {
    resolveTicker(symbol: $symbol) {
      symbol
      name
      assetClass
      price
      changePct
      currency
      domain
    }
  }
`;

interface SecurityMatch {
  symbol: string;
  name: string;
  assetClass: string;
  exchange: string;
  domain: string | null;
}

interface TickerQuote {
  symbol: string;
  name: string;
  assetClass: string;
  price: number | null;
  changePct: number | null;
  currency: string;
  domain: string | null;
}

export interface InvestmentFormValues {
  name: string;
  symbol: string;
  assetClass: string;
  accountId: string;
  value: string;
  costBasis: string;
  quantity: string;
}

export type InvestmentFormErrors = Partial<
  Record<"name" | "assetClass" | "value" | "costBasis" | "quantity", string>
>;

export const EMPTY_INVESTMENT: InvestmentFormValues = {
  name: "",
  symbol: "",
  assetClass: "Stocks",
  accountId: "",
  value: "",
  costBasis: "",
  quantity: "",
};

/** Validate values; returns field→message map (empty = valid). */
export function validateInvestment(v: InvestmentFormValues): InvestmentFormErrors {
  const errors: InvestmentFormErrors = {};
  if (!v.name.trim()) errors.name = "Give the investment a name.";
  if (!ASSET_CLASSES.includes(v.assetClass as (typeof ASSET_CLASSES)[number])) {
    errors.assetClass = "Pick an asset class.";
  }
  const value = Number(v.value);
  if (!v.value.trim() || !Number.isFinite(value) || value <= 0) {
    errors.value = "Enter a value greater than zero.";
  }
  if (v.costBasis.trim()) {
    const cb = Number(v.costBasis);
    if (!Number.isFinite(cb) || cb < 0) errors.costBasis = "Cost basis can’t be negative.";
  }
  if (v.quantity.trim()) {
    const q = Number(v.quantity);
    if (!Number.isFinite(q) || q < 0) errors.quantity = "Quantity can’t be negative.";
  }
  return errors;
}

interface InvestmentFormProps {
  values: InvestmentFormValues;
  errors: InvestmentFormErrors;
  onChange: (patch: Partial<InvestmentFormValues>) => void;
  /** When the parent modal opens — triggers the account fetch. */
  open: boolean;
  /** id prefix so Add/Edit don't collide on field ids. */
  idPrefix: string;
}

export function InvestmentForm({ values, errors, onChange, open, idPrefix }: InvestmentFormProps) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);

  // Search state.
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SecurityMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [focused, setFocused] = useState(false);

  // Selection / entry mode.
  const [quote, setQuote] = useState<TickerQuote | null>(null); // the picked security
  const [pricing, setPricing] = useState(false); // fetching the selected price
  const [manual, setManual] = useState(false); // user opted into manual entry

  // Refs the debounced/async callbacks read so they don't re-subscribe effects.
  const valuesRef = useRef(values);
  const onChangeRef = useRef(onChange);
  const searchReqRef = useRef(0);
  const quoteReqRef = useRef(0);
  const prefilledRef = useRef(false); // one-shot Edit prefill per open

  useEffect(() => {
    valuesRef.current = values;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!open) return;
    gqlClient
      .request<{ accounts: { id: string; name: string }[] }>(ACCOUNTS)
      .then(({ accounts }) => setAccounts(accounts))
      .catch(() => setAccounts([]));
  }, [open]);

  // Reset transient UI whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults(null);
    setSearching(false);
    setSearchError(false);
    setFocused(false);
    setQuote(null);
    setPricing(false);
    setManual(false);
    prefilledRef.current = false;
  }, [open]);

  // Edit prefill (one-shot): when the modal opens on an existing holding, show
  // its live-priced card (ticker holdings) or the manual fields (ticker-less).
  // Keyed on values.symbol/name so it fires once the parent's prefill commits.
  useEffect(() => {
    if (!open || prefilledRef.current) return;
    if (quote || manual || search) return; // user already moved on
    const v = valuesRef.current;
    const sym = v.symbol.trim();
    if (!sym && !v.name.trim() && !v.value.trim()) return; // still blank (Add, or not committed)

    prefilledRef.current = true;
    if (sym) {
      setPricing(true);
      setQuote({
        symbol: sym.toUpperCase(),
        name: v.name || sym.toUpperCase(),
        assetClass: v.assetClass,
        price: null,
        changePct: null,
        currency: "",
        domain: null,
      });
      const id = ++quoteReqRef.current;
      gqlClient
        .request<{ resolveTicker: TickerQuote | null }>(RESOLVE_TICKER, { symbol: sym })
        .then(({ resolveTicker: q }) => {
          if (id !== quoteReqRef.current) return;
          setPricing(false);
          // Keep the holding's stored name; just enrich with live price + logo.
          if (q) setQuote({ ...q, name: valuesRef.current.name || q.name });
        })
        .catch(() => {
          if (id === quoteReqRef.current) setPricing(false);
        });
    } else {
      setManual(true);
    }
  }, [open, values.symbol, values.name, quote, manual, search]);

  // Debounced security search.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      setSearchError(false);
      return;
    }
    const id = ++searchReqRef.current;
    setSearching(true);
    setSearchError(false);
    const timer = setTimeout(() => {
      gqlClient
        .request<{ searchSecurities: SecurityMatch[] }>(SEARCH_SECURITIES, { query: q })
        .then(({ searchSecurities }) => {
          if (id !== searchReqRef.current) return;
          setResults(searchSecurities ?? []);
          setSearching(false);
        })
        .catch((e) => {
          if (id !== searchReqRef.current) return;
          // A failed request is NOT "no matches" — surface it, and log so the
          // real cause (e.g. an unregistered query before a dev restart) shows.
          console.error("Security search failed:", e);
          setResults(null);
          setSearchError(true);
          setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const hasPrice = !!quote && quote.price != null;
  const hasIdentityErr = !!errors.name || !!errors.assetClass || !!errors.value;
  // Which panel to show. A validation error with nothing selected forces manual
  // so a message never points at a hidden field (e.g. submitting mid-search).
  const phase: "search" | "selected" | "manual" = quote
    ? "selected"
    : manual || hasIdentityErr
      ? "manual"
      : "search";

  const sharesNum = Number(values.quantity);
  const previewValue =
    hasPrice && values.quantity.trim() && Number.isFinite(sharesNum) && sharesNum > 0
      ? quote!.price! * sharesNum
      : null;
  const sharesError = hasPrice && errors.value ? "Enter how many shares you own." : errors.quantity;

  const showDropdown =
    phase === "search" && focused && !!search.trim() && (searching || searchError || results != null);

  // Flat render list: a header entry per asset class followed by its items, in
  // the backend's ranked order (a class appears at its first hit, so the leading
  // type — BTC for "bitcoin", Apple for "AAPL" — stays on top). Grouping separates
  // the types visually so a same-ticker match in another class is never mistaken
  // for the one the user meant. Kept FLAT (one .map in JSX below) so each row's
  // onMouseDown reads as a real event handler — a nested map trips the
  // react-hooks/refs rule on selectMatch's ref access.
  const rows = useMemo(() => {
    if (!results) return [];
    const order: string[] = [];
    const byClass = new Map<string, SecurityMatch[]>();
    for (const m of results) {
      if (!byClass.has(m.assetClass)) {
        byClass.set(m.assetClass, []);
        order.push(m.assetClass);
      }
      byClass.get(m.assetClass)!.push(m);
    }
    const out: (
      | { kind: "header"; assetClass: string }
      | { kind: "item"; assetClass: string; m: SecurityMatch }
    )[] = [];
    for (const assetClass of order) {
      out.push({ kind: "header", assetClass });
      for (const m of byClass.get(assetClass)!) out.push({ kind: "item", assetClass, m });
    }
    return out;
  }, [results]);

  // Typing shares recomputes the stored value from the live price.
  const setShares = (v: string) => {
    const patch: Partial<InvestmentFormValues> = { quantity: v };
    const price = quote?.price ?? null;
    if (price != null) {
      const n = Number(v);
      patch.value = v.trim() && Number.isFinite(n) && n > 0 ? (price * n).toFixed(2) : "";
    }
    onChange(patch);
  };

  const selectMatch = (m: SecurityMatch) => {
    setResults(null);
    setFocused(false);
    setSearch("");
    setPricing(true);
    setQuote({
      symbol: m.symbol,
      name: m.name,
      assetClass: m.assetClass,
      price: null,
      changePct: null,
      currency: "",
      domain: m.domain,
    });
    onChange({ symbol: m.symbol, name: m.name, assetClass: m.assetClass, value: "" });

    const id = ++quoteReqRef.current;
    gqlClient
      .request<{ resolveTicker: TickerQuote | null }>(RESOLVE_TICKER, { symbol: m.symbol })
      .then(({ resolveTicker: q }) => {
        if (id !== quoteReqRef.current) return;
        setPricing(false);
        if (!q) return;
        setQuote(q);
        const cur = valuesRef.current;
        if (q.price != null && cur.quantity.trim()) {
          const n = Number(cur.quantity);
          if (Number.isFinite(n) && n > 0) onChangeRef.current({ value: (q.price * n).toFixed(2) });
        }
      })
      .catch(() => {
        if (id === quoteReqRef.current) setPricing(false);
      });
  };

  const searchAgain = () => {
    quoteReqRef.current++; // cancel any in-flight price fetch
    setQuote(null);
    setPricing(false);
    setManual(false);
    setSearch("");
    setResults(null);
    onChange({ symbol: "", name: "", value: "", quantity: "" });
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* ── Search panel ── */}
      {phase === "search" && (
        <div className="relative">
          <Field
            label="Search for a stock, ETF or crypto"
            hint="By name or ticker, e.g. Apple, VFV, Bitcoin."
            htmlFor={`${idPrefix}-search`}
          >
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-of-muted)]"
              />
              <TextInput
                id={`${idPrefix}-search`}
                className="pl-10"
                value={search}
                autoComplete="off"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls={`${idPrefix}-listbox`}
                aria-autocomplete="list"
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setFocused(true)}
                // Delay so a row's onClick lands before the dropdown unmounts.
                onBlur={() => setTimeout(() => setFocused(false), 120)}
                placeholder="Apple · SHOP.TO · Bitcoin"
              />
            </div>
          </Field>

          {showDropdown && (
            <div
              id={`${idPrefix}-listbox`}
              role="listbox"
              aria-label="Search results"
              // In-flow (not an absolute overlay) so it isn't clipped by the
              // dialog's overflow and doesn't stack a second scroll on top of the
              // dialog's. Its own bounded max-height keeps the list compact and
              // scrollable in place, so the modal itself stays put, and the list
              // is the single scroll surface.
              className="of-scroll mt-1.5 max-h-72 w-full overflow-y-auto overflow-x-hidden rounded-xl bg-[var(--color-of-surface)] py-1.5"
              style={{ border: "1px solid var(--color-of-line-soft)" }}
            >
              {searching && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-[var(--color-of-muted)]">
                  <Loader2 size={15} className="animate-spin" />
                  Searching…
                </div>
              )}
              {!searching &&
                rows.map((row) =>
                  row.kind === "header" ? (
                    <div
                      key={`h:${row.assetClass}`}
                      role="presentation"
                      className="px-3.5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-of-faint)]"
                    >
                      {row.assetClass}
                    </div>
                  ) : (
                    <button
                      key={`${row.assetClass}:${row.m.symbol}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      // onMouseDown fires before the input's onBlur, so the pick registers.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMatch(row.m);
                      }}
                      className="flex w-full min-w-0 items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-[var(--color-of-canvas)]"
                    >
                      <MerchantAvatar
                        name={row.m.name}
                        domain={row.m.domain}
                        bg="var(--color-of-canvas)"
                        ink="var(--color-of-ink)"
                        size={30}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--color-of-ink)]">
                          {row.m.name}
                        </div>
                        <div className="truncate text-xs text-[var(--color-of-muted)]">
                          {row.m.symbol}
                          {row.m.exchange ? ` · ${row.m.exchange}` : ""}
                        </div>
                      </div>
                    </button>
                  ),
                )}
              {!searching && searchError && (
                <div className="px-3.5 py-2.5 text-sm text-[var(--color-of-clay)]">
                  Search is unavailable right now. Try again, or enter details manually.
                </div>
              )}
              {!searching && !searchError && results != null && results.length === 0 && (
                <div className="px-3.5 py-2.5 text-sm text-[var(--color-of-muted)]">
                  No matches for “{search.trim()}”.
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setManual(true)}
            className="mt-3 text-sm font-medium text-[var(--color-of-muted)] underline underline-offset-2 hover:text-[var(--color-of-ink)]"
          >
            Can’t find it? Enter details manually
          </button>
        </div>
      )}

      {/* ── Selected security card ── */}
      {phase === "selected" && quote && (
        <>
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ border: "1px solid var(--color-of-line-soft)", background: "var(--color-of-canvas)" }}
          >
            <MerchantAvatar
              name={quote.name}
              domain={quote.domain}
              bg="var(--color-of-canvas)"
              ink="var(--color-of-ink)"
              size={40}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-[var(--color-of-ink)]">{quote.name}</div>
              <div className="text-xs text-[var(--color-of-muted)]">
                {quote.symbol} · {quote.assetClass}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pricing ? (
                <Loader2 size={16} className="animate-spin text-[var(--color-of-muted)]" />
              ) : hasPrice ? (
                <div className="text-right">
                  <div className="of-num font-semibold text-[var(--color-of-ink)]">
                    {fmt(quote.price!, quote.currency)}
                  </div>
                  {quote.changePct != null && (
                    <div
                      className="of-num text-xs"
                      style={{ color: quote.changePct >= 0 ? "var(--primary)" : "var(--color-of-clay)" }}
                    >
                      {quote.changePct >= 0 ? "+" : ""}
                      {quote.changePct.toFixed(2)}% today
                    </div>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={searchAgain}
                aria-label="Search again"
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-of-muted)] transition-colors hover:bg-[var(--color-of-line-soft)] hover:text-[var(--color-of-ink)]"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <Field
            label="Shares"
            error={sharesError}
            hint={
              previewValue != null
                ? undefined
                : hasPrice
                  ? "How many shares you own. We’ll value it at today’s price."
                  : "Units or shares you hold."
            }
            htmlFor={`${idPrefix}-qty`}
          >
            <TextInput
              id={`${idPrefix}-qty`}
              type="number"
              min="0"
              step="any"
              value={values.quantity}
              invalid={!!sharesError}
              onChange={(e) => setShares(e.target.value)}
              placeholder="0"
            />
            {previewValue != null && (
              <p className="mt-1.5 text-xs text-[var(--color-of-muted)]">
                ≈ <span className="of-num">{fmt(previewValue, quote.currency)}</span> at today’s price
              </p>
            )}
          </Field>

          {/* No live price (fetch failed / unsupported) → enter the value by hand. */}
          {!hasPrice && !pricing && (
            <Field label="Current value" error={errors.value} htmlFor={`${idPrefix}-value`}>
              <TextInput
                id={`${idPrefix}-value`}
                type="number"
                min="0"
                step="0.01"
                value={values.value}
                invalid={!!errors.value}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="0.00"
              />
            </Field>
          )}
        </>
      )}

      {/* ── Manual entry ── */}
      {phase === "manual" && (
        <>
          <Field label="Name" error={errors.name} htmlFor={`${idPrefix}-name`}>
            <TextInput
              id={`${idPrefix}-name`}
              value={values.name}
              invalid={!!errors.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Rental property, Series I bond"
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Asset class" error={errors.assetClass} htmlFor={`${idPrefix}-class`} className="flex-1">
              <SelectInput
                id={`${idPrefix}-class`}
                value={values.assetClass}
                invalid={!!errors.assetClass}
                onChange={(e) => onChange({ assetClass: e.target.value })}
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Current value" error={errors.value} htmlFor={`${idPrefix}-value`} className="flex-1">
              <TextInput
                id={`${idPrefix}-value`}
                type="number"
                min="0"
                step="0.01"
                value={values.value}
                invalid={!!errors.value}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="0.00"
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={searchAgain}
            className="text-sm font-medium text-[var(--color-of-muted)] underline underline-offset-2 hover:text-[var(--color-of-ink)]"
          >
            Search for a ticker instead
          </button>
        </>
      )}

      {/* ── Shared trailing fields (once we're past search) ── */}
      {phase !== "search" && (
        <>
          <Field label="Account" optional htmlFor={`${idPrefix}-account`}>
            <SelectInput
              id={`${idPrefix}-account`}
              value={values.accountId}
              onChange={(e) => onChange({ accountId: e.target.value })}
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field
            label="Cost basis"
            optional
            error={errors.costBasis}
            hint="Total you paid, enables gain/loss."
            htmlFor={`${idPrefix}-cost`}
          >
            <TextInput
              id={`${idPrefix}-cost`}
              type="number"
              min="0"
              step="0.01"
              value={values.costBasis}
              invalid={!!errors.costBasis}
              onChange={(e) => onChange({ costBasis: e.target.value })}
              placeholder="0.00"
            />
          </Field>
        </>
      )}
    </div>
  );
}
