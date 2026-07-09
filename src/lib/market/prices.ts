import "server-only";

// Live market quotes for investment holdings. SERVER-ONLY (hits third-party
// APIs). Called from getInvestments during the RSC render — server-side, so it
// is NOT subject to the browser CSP.
//
// Providers:
//   • Search (name/ticker → candidates) → Twelve Data /symbol_search. KEYLESS —
//     works with no config, covers US + Canadian (TSX) + more.
//   • Stocks / ETFs quotes → Twelve Data /quote. Needs a FREE api key
//     (TWELVEDATA_API_KEY; 800 req/day). Covers US + Canadian listings, priced
//     in the listing's native currency, which we convert to the user's currency.
//     Without a key, search still works and quotes degrade to null (the holding
//     falls back to its stored value / manual entry).
//   • Crypto → CoinGecko /simple/price — keyless, priced directly in the user's
//     currency, 24/7.
//   • FX (native → display currency) → open.er-api.com — keyless.
//
// We use Twelve Data (over Yahoo, which 429s automated/server requests) because
// its search is keyless and reliable server-side. To swap providers, replace
// `twelveDataQuotes` / `searchSymbols`; nothing else in the app changes.
//
// A small module-level cache (60s for quotes, 12h for FX) keeps requests light.

export interface Quote {
  /** Latest per-unit price, in the requested display currency. */
  price: number;
  /** Absolute per-unit change on the day, in the display currency. */
  change: number;
  /** Percent change on the day. */
  changePct: number;
}

/**
 * A raw ticker the user typed, resolved to a real security + live quote: its
 * canonical symbol (normalized for our quote path), name, asset class, and a
 * price in the display currency. `price`/`changePct` are null when the symbol
 * was identified but the quote itself failed (offline / rate-limited).
 */
export interface SymbolLookup {
  symbol: string;
  name: string;
  assetClass: string;
  price: number | null;
  changePct: number | null;
  currency: string;
}

/** One candidate from a name/ticker search — enough to render a picker row.
    No price (that would be N quote calls per keystroke); the price is fetched
    once, on selection, via lookupSymbol. */
export interface SecurityMatch {
  symbol: string;
  name: string;
  assetClass: string;
  /** Display exchange, e.g. "NASDAQ", "Toronto". */
  exchange: string;
}

const QUOTE_TTL = 60_000; // 60s
const FX_TTL = 12 * 60 * 60_000; // 12h

const quoteCache = new Map<string, { q: Quote | null; at: number }>();
let fxCache: { rates: Record<string, number>; at: number } | null = null;

// Twelve Data. symbol_search is keyless; quotes need this free key. Read lazily
// so a key added to .env after boot is picked up on the next server request.
const TD_BASE = "https://api.twelvedata.com";
const tdKey = () => process.env.TWELVEDATA_API_KEY?.trim() || "";
const tdAuth = () => (tdKey() ? `&apikey=${tdKey()}` : "");

// Common ticker → CoinGecko id. Unknown symbols fall back to the lowercased
// ticker as the id; a miss just yields no quote.
const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  LINK: "chainlink",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  USDC: "usd-coin",
  USDT: "tether",
};

async function fetchJson(url: string, init: RequestInit = {}, ms = 4500): Promise<unknown | null> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    const res = await fetch(url, { cache: "no-store", signal: ctl.signal, ...init });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** USD-based FX table (1 USD = rates[X] X), cached 12h. */
async function fxRates(): Promise<Record<string, number>> {
  if (fxCache && Date.now() - fxCache.at < FX_TTL) return fxCache.rates;
  const json = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as
    | { rates?: Record<string, number> }
    | null;
  if (json?.rates) {
    const rates = { USD: 1, ...json.rates };
    fxCache = { rates, at: Date.now() };
    return rates;
  }
  return fxCache?.rates ?? { USD: 1 };
}

/** Convert `amount` from one currency to another via the USD-based table. */
function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const f = rates[from.toUpperCase()];
  const t = rates[to.toUpperCase()];
  if (!f || !t) return amount; // Unknown currency → leave as-is rather than guess.
  return amount * (t / f);
}

/**
 * Twelve Data batch quote for stocks/ETFs → Quotes keyed by UPPERCASE symbol,
 * already converted to `displayCur`. One call for all symbols (comma-joined);
 * the response is a single object for one symbol, else keyed by symbol. Needs
 * TWELVEDATA_API_KEY — without it we return nothing (graceful degrade). Twelve
 * Data prices in the listing's native currency, so we FX-convert to display.
 */
async function twelveDataQuotes(
  symbols: string[],
  displayCur: string,
  rates: Record<string, number>,
): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  if (!symbols.length || !tdKey()) return out;

  const json = (await fetchJson(
    `${TD_BASE}/quote?symbol=${symbols.map(encodeURIComponent).join(",")}${tdAuth()}`,
    { headers: { Accept: "application/json" } },
  )) as Record<string, unknown> | null;
  if (!json) return out;

  // Normalize: single-symbol response is a bare quote object (has `symbol`);
  // multi-symbol is an object keyed by each symbol.
  const rows: Record<string, Record<string, unknown>> = {};
  if (typeof json.symbol === "string") {
    rows[json.symbol.toUpperCase()] = json;
  } else {
    for (const [k, v] of Object.entries(json)) {
      if (v && typeof v === "object") rows[k.toUpperCase()] = v as Record<string, unknown>;
    }
  }

  for (const sym of symbols) {
    const row = rows[sym.toUpperCase()];
    // Twelve Data flags per-symbol errors with status:"error" or a `code`.
    if (!row || row.status === "error" || row.code) continue;
    const close = Number(row.close);
    if (!Number.isFinite(close) || close <= 0) continue;
    const prevRaw = Number(row.previous_close);
    const prev = Number.isFinite(prevRaw) && prevRaw > 0 ? prevRaw : close;
    const native = typeof row.currency === "string" ? row.currency.toUpperCase() : displayCur;
    const price = convert(close, native, displayCur, rates);
    const prevC = convert(prev, native, displayCur, rates);
    out[sym.toUpperCase()] = {
      price,
      change: price - prevC,
      changePct: prevC > 0 ? ((price - prevC) / prevC) * 100 : 0,
    };
  }
  return out;
}

async function coinGeckoQuotes(
  ids: string[],
  currency: string,
): Promise<Record<string, { price: number; changePct: number }>> {
  if (!ids.length) return {};
  const vs = currency.toLowerCase();
  const json = (await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${vs}&include_24hr_change=true`,
  )) as Record<string, Record<string, number>> | null;
  if (!json) return {};
  const out: Record<string, { price: number; changePct: number }> = {};
  for (const id of ids) {
    const row = json[id];
    if (row && typeof row[vs] === "number") {
      out[id] = { price: row[vs], changePct: row[`${vs}_24h_change`] ?? 0 };
    }
  }
  return out;
}

/**
 * Resolve live quotes for the given holdings, keyed by UPPERCASE symbol, priced
 * in `currency`. Crypto is split off to CoinGecko; everything else goes to
 * Twelve Data (US + Canadian). Only misses/expired entries hit the network.
 */
export async function getQuotes(
  items: { symbol: string; assetClass: string }[],
  currency: string,
): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>();
  const cur = (currency || "CAD").toUpperCase();

  // Dedupe by uppercased symbol; last asset class wins (a symbol is one thing).
  const bySymbol = new Map<string, string>();
  for (const it of items) {
    const sym = it.symbol?.trim().toUpperCase();
    if (sym) bySymbol.set(sym, it.assetClass);
  }
  if (!bySymbol.size) return result;

  const stocks: string[] = [];
  const cryptos: string[] = [];
  for (const [sym, cls] of bySymbol) {
    const hit = quoteCache.get(`${sym}:${cur}`);
    if (hit && Date.now() - hit.at < QUOTE_TTL) {
      if (hit.q) result.set(sym, hit.q);
      continue;
    }
    if (cls === "Crypto") cryptos.push(sym);
    else stocks.push(sym);
  }

  // ── Crypto (one batched CoinGecko call, priced in `cur` directly) ──
  if (cryptos.length) {
    const idBySym = new Map(cryptos.map((s) => [s, CRYPTO_IDS[s] ?? s.toLowerCase()]));
    const cg = await coinGeckoQuotes([...new Set(idBySym.values())], cur);
    for (const sym of cryptos) {
      const row = cg[idBySym.get(sym)!];
      let q: Quote | null = null;
      if (row) {
        const prev = row.changePct !== -100 ? row.price / (1 + row.changePct / 100) : row.price;
        q = { price: row.price, change: row.price - prev, changePct: row.changePct };
      }
      quoteCache.set(`${sym}:${cur}`, { q, at: Date.now() });
      if (q) result.set(sym, q);
    }
  }

  // ── Stocks / ETFs (Twelve Data, native currency → `cur`), one batched call ──
  if (stocks.length) {
    const rates = await fxRates();
    const td = await twelveDataQuotes(stocks, cur, rates);
    for (const sym of stocks) {
      const q = td[sym.toUpperCase()] ?? null;
      quoteCache.set(`${sym}:${cur}`, { q, at: Date.now() });
      if (q) result.set(sym, q);
    }
  }

  return result;
}

// Twelve Data instrument_type → our ASSET_CLASSES bucket. Kept as string
// literals so this module stays dependency-free; values must match constants.
function assetClassForInstrument(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("etf")) return "ETFs";
  if (t.includes("fund")) return "ETFs";
  if (t.includes("digital currency") || t.includes("crypto")) return "Crypto";
  if (t.includes("bond")) return "Bonds";
  if (
    t.includes("stock") ||
    t.includes("equity") ||
    t.includes("share") ||
    t.includes("depositary") // ADRs
  ) {
    return "Stocks";
  }
  return "Other";
}

// Exchange preference so a symbol listed on many venues (AAPL trades on a dozen)
// is represented by its US/Canadian primary listing, not a thin foreign one.
// Lower = preferred; everything else sorts last.
const EXCHANGE_RANK: Record<string, number> = {
  NASDAQ: 0,
  NYSE: 0,
  "NYSE ARCA": 0,
  "NYSE AMERICAN": 0,
  ARCA: 0,
  AMEX: 0,
  TSX: 0,
  "TSX VENTURE": 1,
  TSXV: 1,
  NEO: 1,
  CBOE: 1,
  CSE: 2,
};
const exchangeRank = (ex: string) => EXCHANGE_RANK[ex.toUpperCase()] ?? 9;

/** Twelve Data symbol search → stock/ETF/fund candidates, ranked so the US/CA
    primary listing wins, then deduped by symbol (one row per company). */
async function twelveDataSearch(query: string): Promise<SecurityMatch[]> {
  const json = (await fetchJson(
    `${TD_BASE}/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=30${tdAuth()}`,
    { headers: { Accept: "application/json" } },
  )) as { data?: Record<string, unknown>[] } | null;
  const data = json?.data;
  if (!Array.isArray(data)) return [];

  const rows: { m: SecurityMatch; rank: number }[] = [];
  for (const r of data) {
    const symbol = String(r.symbol ?? "").trim().toUpperCase();
    if (!symbol) continue;
    const assetClass = assetClassForInstrument(String(r.instrument_type ?? ""));
    if (assetClass === "Crypto") continue; // crypto comes from CoinGecko below
    if (assetClass === "Other") continue; // drop warrants / structured notes / indices
    const exchange = String(r.exchange ?? "").trim();
    const rank = exchangeRank(exchange);
    if (rank >= 9) continue; // US + Canadian listings only — trims foreign-exchange noise
    const name = String(r.instrument_name ?? "").trim() || symbol;
    rows.push({ m: { symbol, name, assetClass, exchange }, rank });
  }
  // Array.sort is stable, so ties keep Twelve Data's own (primary-first) order.
  rows.sort((a, b) => a.rank - b.rank);

  const out: SecurityMatch[] = [];
  const seen = new Set<string>();
  for (const { m } of rows) {
    if (seen.has(m.symbol)) continue;
    seen.add(m.symbol);
    out.push(m);
    if (out.length >= 8) break;
  }
  return out;
}

// Tokenized/wrapped equities (Robinhood Token, xStock, Ondo, Dinari dShares, …)
// mirror a real stock's ticker and name on CoinGecko — "Apple • Robinhood Token"
// even carries the symbol AAPL. They are not the security someone means when they
// type a stock ticker, and they price as thin crypto tokens (cents, not the share
// price), so we drop them: a stock search must resolve to the actual listing.
// "tokeniz" is anchored to stock/equity so a real coin like "Tokenize Xchange"
// (TKX) isn't caught by the word alone.
const TOKENIZED_EQUITY_RE =
  /tokeniz\w*\s+(stock|equit)|x ?stock|robinhood token|d-?shares|dinari|backed (stock|equit)|wrapped .*stock/i;

// Only a well-ranked coin may lead over a stock. Real coins a user would type
// (BTC #1, ETH #2, SOL #7, and down through the majors) sit near the top;
// impostor tokens that reuse an equity's ticker and unrelated memecoins live in
// the hundreds/thousands. Above this rank, a same-name/ticker "match" is noise.
const CRYPTO_LEAD_MAX_RANK = 200;

/** A search candidate carrying its CoinGecko market-cap rank, used only to decide
    ordering (whether crypto should lead). Stripped to a plain SecurityMatch before
    results leave searchSymbols. */
type RankedMatch = SecurityMatch & { rank: number };

/** CoinGecko coin search → the top ranked coins matching the query. Keyless.
    Unranked junk tokens are dropped so "apple" doesn't surface a memecoin, and
    tokenized-stock tokens are dropped so "AAPL" resolves to Apple Inc., not a
    Robinhood/xStock token that reuses the ticker. */
async function coinGeckoSearch(query: string): Promise<RankedMatch[]> {
  const json = (await fetchJson(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
  )) as { coins?: Record<string, unknown>[] } | null;
  const coins = json?.coins;
  if (!Array.isArray(coins)) return [];

  const out: RankedMatch[] = [];
  for (const c of coins) {
    const rank = c.market_cap_rank;
    if (typeof rank !== "number") continue; // skip unranked junk
    const symbol = String(c.symbol ?? "").trim().toUpperCase();
    if (!symbol) continue;
    const name = String(c.name ?? "").trim() || symbol;
    if (TOKENIZED_EQUITY_RE.test(name)) continue; // not a coin — a tokenized equity
    out.push({ symbol, name, assetClass: "Crypto", exchange: "Crypto", rank });
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Search stocks/ETFs (Twelve Data, keyless) + crypto (CoinGecko, keyless) for a
 * name OR ticker, merged into one deduped list. Crypto leads only when the query
 * clearly names a coin (exact symbol/name), so "apple" leads with Apple Inc. but
 * "bitcoin" leads with BTC. Either provider failing just drops its rows.
 */
export async function searchSymbols(query: string): Promise<SecurityMatch[]> {
  const q = query.trim();
  if (!q) return [];

  const [stocks, cryptos] = await Promise.all([twelveDataSearch(q), coinGeckoSearch(q)]);

  // Crypto leads only when the query clearly names a real coin: an exact
  // symbol/name hit on a well-ranked token, so "bitcoin"/"BTC" leads with BTC
  // (over a spot-BTC ETF), while "AAPL"/"apple"/"TSLA" lead with the equity — the
  // tokenized tokens that reuse those tickers are already dropped above, and any
  // leftover same-ticker memecoin is out-ranked past the cap. Otherwise stocks
  // lead, falling back to crypto only when no stock matched at all.
  const qU = q.toUpperCase();
  const qL = q.toLowerCase();
  const cryptoLeads = cryptos.some(
    (c) => (c.symbol === qU || c.name.toLowerCase() === qL) && c.rank <= CRYPTO_LEAD_MAX_RANK,
  );
  const ordered = cryptoLeads
    ? [...cryptos, ...stocks]
    : stocks.length > 0
      ? stocks
      : cryptos;

  const out: SecurityMatch[] = [];
  const seen = new Set<string>();
  for (const m of ordered) {
    if (seen.has(m.symbol)) continue;
    seen.add(m.symbol);
    // Strip the internal rank — results leave as plain SecurityMatch.
    out.push({ symbol: m.symbol, name: m.name, assetClass: m.assetClass, exchange: m.exchange });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Resolve one symbol into a live quote + canonical name/class, priced via the
 * SAME path getInvestments uses (getQuotes), so the previewed price equals the
 * value we later store. Prefers an exact-symbol match from the search results.
 * Returns null only when the symbol can't be identified at all.
 */
export async function lookupSymbol(rawSymbol: string, currency: string): Promise<SymbolLookup | null> {
  const cur = (currency || "CAD").toUpperCase();
  const query = rawSymbol.trim();
  if (!query) return null;

  const matches = await searchSymbols(query);
  if (!matches.length) return null;
  const upper = query.toUpperCase();
  const hit = matches.find((m) => m.symbol === upper) ?? matches[0];

  const quotes = await getQuotes([{ symbol: hit.symbol, assetClass: hit.assetClass }], cur);
  const q = quotes.get(hit.symbol);

  return {
    symbol: hit.symbol,
    name: hit.name,
    assetClass: hit.assetClass,
    price: q ? q.price : null,
    changePct: q ? q.changePct : null,
    currency: cur,
  };
}
