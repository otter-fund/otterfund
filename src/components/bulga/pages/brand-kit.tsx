"use client";

// Bulga BRAND KIT — the live design-system showcase.
//
// Translated from the design spec (lines 346-451). Every value derives from the
// active `accent` via deriveTheme(), so tapping a scheme retones the whole app:
// the picker just calls onAccentChange — the shell owns accent state and pushes
// it back down as `accent` + `theme`. No hardcoded sample data ships here.

import { useEffect, useState, type CSSProperties } from "react";

import { LogoMark } from "@/components/bulga/logo";
import { BANKNOTE_SCHEMES, LOGO_GREEN, deriveTheme, themeVars, type BulgaTheme } from "@/components/bulga/theme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, TextInput, SelectInput } from "@/components/bulga/form";
import { ProgressBar, ProgressRing } from "@/components/bulga/progress";
import { StatPill } from "@/components/bulga/stat-pill";
import { GuillocheLoader } from "@/components/bulga/guilloche-loader";

interface BulgaBrandKitProps {
  accent: string;
  theme: BulgaTheme;
  onAccentChange: (accent: string) => void;
}

export function BulgaBrandKit({ accent, theme, onAccentChange }: BulgaBrandKitProps) {
  // Mirrors the reference's componentDidMount → mounted flag: bars/progress
  // sweep from 0 to their target on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Which banknote-palette variation is being previewed. Tapping one sets the
  // app accent to that variation's primary green and recolours the in-context
  // demo below so you can see all five note colours working as one set.
  const [schemeIdx, setSchemeIdx] = useState(0);
  const activeScheme = BANKNOTE_SCHEMES[schemeIdx];
  const barWidths = [18, 16, 28, 20, 18];

  // Live tuner for the guilloché loader (the "opening an old chat" spinner).
  // Seeded at the values the app actually ships — the maxed, energetic look —
  // so this documents the real thing and lets you dial it from here. `speed`
  // is a global multiplier over the base breathing (0.9 rad/s) and the spin.
  const [loaderSpeed, setLoaderSpeed] = useState(2);
  const [loaderSwing, setLoaderSwing] = useState(3.2);
  const [loaderSpin, setLoaderSpin] = useState(40);

  // Derive the previewed theme the SAME way the app does when you actually pick
  // a scheme (deriveTheme → themeVars), from the variation's $20 green (index 2).
  // This makes the preview a truthful dry run and keeps one source of truth for
  // the accent-token math — no bespoke preview palette to drift.
  const previewTheme = deriveTheme(activeScheme.colors[2].value);

  // Sample spending mapped one-category-per-note — the clearest proof of the
  // banknote palette: it earns its keep on multi-series data, not as a lone
  // accent. `share` sums to 100 for the stacked bar; `pct` is budget-used.
  const spendDemo = [
    { name: "Groceries", amount: "$612", pct: 78, share: 26, color: activeScheme.colors[2].value }, // $20 green
    { name: "Transport", amount: "$340", pct: 43, share: 15, color: activeScheme.colors[0].value }, // $5 blue
    { name: "Dining out", amount: "$455", pct: 58, share: 19, color: activeScheme.colors[3].value }, // $50 red
    { name: "Bills", amount: "$890", pct: 96, share: 30, color: activeScheme.colors[4].value }, // $100 brown
    { name: "Entertainment", amount: "$180", pct: 23, share: 10, color: activeScheme.colors[1].value }, // $10 purple
  ];

  // Live palette built from the active theme (section 3) — every swatch follows
  // the accent, the logo included.
  const palette: { name: string; role: string; value: string; fixed?: boolean }[] = [
    { name: "Canvas", role: "Background", value: "var(--color-bk-canvas)" },
    { name: "Surface", role: "Cards", value: "var(--color-bk-surface)" },
    { name: "Ink", role: "Text", value: theme.ink },
    { name: "Accent", role: "Themed", value: previewTheme.accent },
    { name: "Soft fill", role: "Accent tint", value: previewTheme.accentTint },
    { name: "Deep tone", role: "Figures", value: previewTheme.accentDeep },
    { name: "Clay", role: "Alert", value: theme.clay },
  ];

  const motions: { title: string; desc: string }[] = [
    { title: "Spring press", desc: "Buttons scale to 0.94 on tap, snap back with overshoot." },
    { title: "Nav highlight", desc: "Active item fills smoothly, so you always know where you are." },
    { title: "Bars grow", desc: "Progress sweeps left-to-right on every reveal." },
    { title: "Soft enter", desc: "Screens fade up 10px. Calm, never jarring." },
  ];

  const muted = "oklch(54% 0.012 80)";
  const faint = "oklch(56% 0.012 80)";

  return (
    <div className="bk-enter bk-page">
      {/* ── 1 · logo lockup ── */}
      <section
        className="bk-brand-hero"
        style={{
          background: "oklch(20% 0.014 75)",
          borderRadius: 24,
          padding: 52,
          marginBottom: 16,
        }}
      >
        <div>
          {/* The mark tracks the active accent — pick pink and the logo turns
              pink, so the whole identity moves as one. */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LogoMark size={44} bg={accent} fg="#fff" />
            <span
              style={{
                fontFamily: "var(--font-ui), system-ui, sans-serif",
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-0.035em",
                color: "#fff",
              }}
            >
              Bulga
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-num), Georgia, serif",
              fontSize: 19,
              color: "oklch(82% 0.01 85)",
              margin: "22px 0 0",
              maxWidth: 380,
              lineHeight: 1.4,
            }}
          >
            Your money, in balance. Calm, confident budgeting that does the math
            so you don&apos;t have to.
          </p>
        </div>
      </section>

      {/* ── 2 · Canadian banknote schemes (LIVE) ── */}
      <section
        style={{
          background: "var(--color-bk-surface)",
          border: "1px solid var(--color-bk-line)",
          borderRadius: 20,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Canadian banknote schemes</h3>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: activeScheme.accent }}>
            Tap a variation to preview
          </span>
        </div>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: muted }}>
          One palette built from all five notes ($5 blue, $10 purple, $20 green,
          $50 red, $100 brown) in a few tonal treatments. The whole set works
          together for charts, categories and allocations.
        </p>

        {/* Variation cards — each shows all five note colours as one palette */}
        <div className="bk-scheme-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${BANKNOTE_SCHEMES.length}, 1fr)`, gap: 12 }}>
          {BANKNOTE_SCHEMES.map((s, i) => {
            const isActive = i === schemeIdx;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setSchemeIdx(i);
                  onAccentChange(s.accent);
                }}
                aria-pressed={isActive}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  padding: 14,
                  borderRadius: 14,
                  background: isActive ? "oklch(98% 0.004 90)" : "#fff",
                  border: isActive ? `1.5px solid ${s.accent}` : "1px solid var(--color-bk-line)",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
                  {s.colors.map((c) => (
                    <div key={c.label} style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ height: 34, borderRadius: 7, background: c.value }} />
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          color: faint,
                          textAlign: "center",
                          marginTop: 4,
                        }}
                      >
                        {c.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: faint, marginTop: 3, lineHeight: 1.4 }}>{s.note}</div>
              </button>
            );
          })}
        </div>

        {/* In context — all five colours used together */}
        <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--color-bk-line-soft)" }}>
          <div style={{ fontSize: 11.5, color: faint, marginBottom: 12 }}>{activeScheme.name} · in context</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {activeScheme.colors.map((c) => (
              <span
                key={c.label}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: c.value,
                  color: "#fff",
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden" }}>
            {activeScheme.colors.map((c, idx) => (
              <div
                key={c.label}
                style={{
                  width: mounted ? `${barWidths[idx]}%` : "0%",
                  background: c.value,
                  transition: `width .9s cubic-bezier(.22,.61,.36,1) ${idx * 80}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── 2b · applied to a real surface (spending) ── */}
      <section
        style={{
          background: "var(--color-bk-surface)",
          border: "1px solid var(--color-bk-line)",
          borderRadius: 20,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>On your spending</h3>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: faint }}>{activeScheme.name}</span>
        </div>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: muted }}>
          Where the palette earns its keep: one note colour per category, so a
          breakdown reads at a glance instead of leaning on a single accent.
        </p>

        {/* Where it goes — one stacked bar across the five categories */}
        <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 22 }}>
          {spendDemo.map((d, idx) => (
            <div
              key={d.name}
              title={`${d.name} · ${d.amount}`}
              style={{
                width: mounted ? `${d.share}%` : "0%",
                background: d.color,
                transition: `width .9s cubic-bezier(.22,.61,.36,1) ${idx * 70}ms`,
              }}
            />
          ))}
        </div>

        {/* Category rows — mirrors the real spending-tab pattern */}
        <div style={{ display: "grid", gap: 15 }}>
          {spendDemo.map((d, idx) => (
            <div key={d.name} style={{ display: "grid", gridTemplateColumns: "14px 1fr", alignItems: "center", gap: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: d.color }} aria-hidden="true" />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.name}</span>
                  <span className="bk-num" style={{ fontSize: 13.5, fontWeight: 600 }}>{d.amount}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--color-bk-track)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: mounted ? `${d.pct}%` : "0%",
                      background: d.color,
                      borderRadius: 999,
                      transition: `width 1s cubic-bezier(.22,.61,.36,1) ${idx * 70}ms`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 · color palette (live) ── */}
      <section
        style={{
          background: "var(--color-bk-surface)",
          border: "1px solid var(--color-bk-line)",
          borderRadius: 20,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Color</h3>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: muted }}>
          Warm-neutral canvas, near-monochrome ink, one confident accent used
          sparingly. Clay flags only what needs attention.
        </p>
        <div className="bk-grid-swatches" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
          {palette.map((p) => (
            <div key={p.name}>
              <div
                style={{
                  position: "relative",
                  height: 76,
                  borderRadius: 14,
                  background: p.value,
                  border: p.fixed
                    ? `1.5px solid ${LOGO_GREEN}`
                    : "1px solid oklch(90% 0.006 85 / 0.6)",
                }}
              >
                {p.fixed && (
                  <span
                    aria-hidden="true"
                    title="Fixed: never follows the accent"
                    style={{
                      position: "absolute",
                      top: 7,
                      right: 7,
                      display: "grid",
                      placeItems: "center",
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: "oklch(100% 0 0 / 0.9)",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={LOGO_GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 9 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: faint, marginTop: 1 }}>{p.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 + 5 · type / components two-up ── */}
      <section
        className="bk-grid-2up"
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Type */}
        <div
          style={{
            background: "var(--color-bk-surface)",
            border: "1px solid var(--color-bk-line)",
            borderRadius: 20,
            padding: 28,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Type</h3>
          <div
            style={{
              borderBottom: "1px solid var(--color-bk-line-soft)",
              paddingBottom: 18,
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 11.5, color: faint, marginBottom: 6 }}>
              Newsreader · display &amp; figures
            </div>
            <div
              className="bk-num"
              style={{ fontSize: 46, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}
            >
              $154,291
            </div>
            <div style={{ fontFamily: "var(--font-num), Georgia, serif", fontSize: 22, marginTop: 8, color: previewTheme.accentDeep }}>
              Money, made plain.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: faint, marginBottom: 8 }}>
              Hanken Grotesk · interface &amp; data
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>Heading · 700</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 5 }}>Subhead · 600</div>
            <div style={{ fontSize: 13.5, color: "oklch(40% 0.012 80)", marginTop: 5, lineHeight: 1.5 }}>
              Body copy stays friendly and plain. We explain, never lecture. 400
              weight at 13–15px.
            </div>
          </div>
        </div>

        {/* Components — scope the PREVIEWED theme onto this card with the SAME
            themeVars the shell applies globally, so the real Button/Badge/input/
            progress inside retone live (and identically to how picking the
            scheme would look) when you tap a variation. */}
        <div
          style={
            {
              background: "var(--color-bk-surface)",
              border: "1px solid var(--color-bk-line)",
              borderRadius: 20,
              padding: 28,
              ...themeVars(previewTheme),
            } as CSSProperties
          }
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Components</h3>

          {/* The actual <Button> variants future devs build on — rendered with
              NO inline overrides, so this documents exactly what the component
              produces. They inherit the live accent through the primary token. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <Button size="sm">Primary</Button>
            <Button variant="outline" size="sm">Outline</Button>
            <Button variant="secondary" size="sm">Secondary</Button>
            <Button variant="ghost" size="sm">Ghost</Button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 18 }}>
            <Button variant="danger" size="sm">Delete</Button>
            <Button variant="destructive" size="sm">Destructive</Button>
            <Button variant="link">View all →</Button>
          </div>

          {/* The real <Badge> variants. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            <Badge>On track</Badge>
            <Badge variant="secondary">Neutral</Badge>
            <Badge variant="destructive">Due soon</Badge>
            <Badge variant="outline">Draft</Badge>
          </div>

          {/* The real <StatPill> — the figure+label pill used for net-worth
              change, budget remaining, subscriptions needing attention. */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <StatPill
              theme={previewTheme}
              figure="+$1,240"
              label="this month"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              }
            />
            <StatPill theme={previewTheme} tone="clay" figure={3} label="need attention" />
          </div>

          {/* The real form controls (bulga/form) — the exact fields every modal
              builds on, so this documents the live control styling. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Text input">
              <TextInput placeholder="e.g. Groceries" />
            </Field>
            <Field label="Select">
              <SelectInput defaultValue="cad">
                <option value="cad">CAD $</option>
                <option value="usd">USD $</option>
              </SelectInput>
            </Field>
          </div>

          {/* The real ProgressBar + ProgressRing (bulga/progress) — the same
              indicators the overview/spending/subscriptions bars and goal rings
              are built from. Both sweep from 0 on mount. */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ProgressBar value={64} className="flex-1" />
            <ProgressRing value={64} size={48} stroke={5} />
          </div>
        </div>
      </section>

      {/* ── 5b · loader (live tuner) ── */}
      <section
        style={{
          background: "var(--color-bk-surface)",
          border: "1px solid var(--color-bk-line)",
          borderRadius: 20,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Loader</h3>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: muted }}>
          The guilloché seal, alive: the spinner shown while a chat loads. Its
          rosette breathes and revolves in an endless rolling shift. Dial it in
          below; it follows the active accent.
        </p>

        <div
          className="bk-loader-tuner"
          style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 28, alignItems: "center" }}
        >
          {/* preview on the current accent */}
          <div style={{ display: "grid", placeItems: "center" }}>
            <div style={{ width: 132, height: 132 }} aria-hidden>
              <GuillocheLoader
                accent={previewTheme.accent}
                accentDeep={previewTheme.accentDeep}
                penSwing={loaderSwing}
                swingHz={0.9 * loaderSpeed}
                spinDps={loaderSpin * loaderSpeed}
              />
            </div>
          </div>

          {/* controls */}
          <div style={{ display: "grid", gap: 16 }}>
            <TunerSlider
              label="Speed"
              value={loaderSpeed}
              min={0.25}
              max={2}
              step={0.05}
              suffix="×"
              accent={previewTheme.accent}
              onChange={setLoaderSpeed}
            />
            <TunerSlider
              label="Swing"
              value={loaderSwing}
              min={0}
              max={3.2}
              step={0.1}
              accent={previewTheme.accent}
              onChange={setLoaderSwing}
            />
            <TunerSlider
              label="Spin"
              value={loaderSpin}
              min={0}
              max={40}
              step={1}
              suffix="°/s"
              accent={previewTheme.accent}
              onChange={setLoaderSpin}
            />
          </div>
        </div>
      </section>

      {/* ── 6 · motion & feel ── */}
      <section
        style={{
          background: "var(--color-bk-surface)",
          border: "1px solid var(--color-bk-line)",
          borderRadius: 20,
          padding: 28,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Motion &amp; feel</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: muted }}>
          Snappy, never showy. Spring on press, ease on reveal, and every action
          confirms itself.
        </p>
        <div className="bk-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {motions.map((mItem) => (
            <div
              key={mItem.title}
              style={{
                background: "oklch(98% 0.004 90)",
                border: "1px solid oklch(93% 0.005 85)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{mItem.title}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 5, lineHeight: 1.45 }}>{mItem.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TunerSlider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  accent,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  accent: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "64px 1fr 56px", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
      />
      <span className="bk-num" style={{ fontSize: 12.5, color: "oklch(54% 0.012 80)", textAlign: "right" }}>
        {value}
        {suffix}
      </span>
    </label>
  );
}
