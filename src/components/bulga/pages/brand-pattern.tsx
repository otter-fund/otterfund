"use client";

// Brand kit · Guilloché & engraving showcase.
//
// The banknote line-work as brand texture. Each generative element gets a full-
// width preview with a compact row of sliders beneath it, so the visual has room
// to breathe. Everything follows the active accent from the chrome context.

import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardLabel } from "@/components/bulga/card";
import { GuillochePattern, GuillocheSeal, braid, waveField } from "@/components/bulga/guilloche";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";

/* ------------------------------------------------------------------ *
 * Patterns in use — the guilloché as a quiet backdrop behind real
 * Bulga surfaces.
 * ------------------------------------------------------------------ */

interface SealConfig {
  petals: number;
  inner: number;
  pen: number;
  label: string;
}

function InUse({ accent, accentDeep, seal }: { accent: string; accentDeep: string; seal: SealConfig }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Hero balance — banknote-style, field denser toward the right. */}
      <Card className="relative col-span-full overflow-hidden p-6">
        <GuillochePattern accent={accent} accentDeep={accentDeep} fade="left" opacity={0.24} />
        <div className="relative">
          <CardLabel>Total balance</CardLabel>
          <div className="bk-num mt-2 text-[40px] leading-none tracking-tight text-[var(--color-bk-ink)]">
            {fmt(48213.55)}
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-bk-muted)]">Across 4 accounts · updated today</p>
        </div>
      </Card>

      {/* Empty state — field fades up, away from the centred copy. */}
      <Card className="relative grid min-h-[180px] place-items-center overflow-hidden p-6 text-center">
        <GuillochePattern accent={accent} accentDeep={accentDeep} fade="bottom" opacity={0.3} />
        <div className="relative">
          <div className="text-[14px] font-semibold text-[var(--color-bk-ink)]">No transactions yet</div>
          <p className="mx-auto mt-1 max-w-[220px] text-[13px] text-[var(--color-bk-muted)]">
            Import a statement to see spending here.
          </p>
        </div>
      </Card>

      {/* Seal / badge — the rosette, contained. Shares config with §05. */}
      <Card className="flex items-center gap-4 p-6">
        <div className="h-[92px] w-[92px] shrink-0">
          <GuillocheSeal accent={accent} accentDeep={accentDeep} petals={seal.petals} inner={seal.inner} pen={seal.pen} label={seal.label} />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[var(--color-bk-ink)]">Verified seal</div>
          <p className="mt-1 text-[13px] text-[var(--color-bk-muted)]">
            A guilloché medallion for stamps, achievement badges or export watermarks.
          </p>
        </div>
      </Card>

      {/* Braided ribbon divider. */}
      <Card className="col-span-full overflow-hidden p-6">
        <div className="flex items-center gap-4">
          <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--color-bk-ink)]">Statement</span>
          <svg viewBox="0 0 400 16" preserveAspectRatio="none" className="h-4 flex-1" aria-hidden>
            <path d={braid(400, 8, 5, 12, 0)} fill="none" stroke={accentDeep} strokeWidth={0.9} opacity={0.7} />
            <path d={braid(400, 8, 5, 12, Math.PI)} fill="none" stroke={accent} strokeWidth={0.9} opacity={0.7} />
          </svg>
          <span className="bk-num whitespace-nowrap text-[13px] text-[var(--color-bk-muted)]">June 2026</span>
        </div>
        <p className="mt-3 text-[12px] text-[var(--color-bk-muted)]">
          The braided sine ribbon as a section divider — a lighter touch than a full field.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 02 · Wave field — the engine-turned backdrop.
 * ------------------------------------------------------------------ */

function Playground({ accent, accentDeep }: { accent: string; accentDeep: string }) {
  const [amp, setAmp] = useState(7);
  const [freq, setFreq] = useState(5); // ×0.01
  const [gap, setGap] = useState(13);
  const [broken, setBroken] = useState(true);

  const W = 600;
  const H = 260;
  const lines = useMemo(() => waveField(W, H, gap, amp, freq / 100, 0.6), [amp, freq, gap]);
  const dash = broken ? "3 4.5" : undefined;

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full rounded-[14px] bg-[var(--color-bk-surface)]"
        role="img"
        aria-label="Engine-turned wave field"
        style={{ height: H }}
      >
        {lines.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 2 ? accent : accentDeep}
            strokeWidth={0.85}
            strokeDasharray={dash}
            strokeLinecap="round"
            opacity={0.55}
          />
        ))}
      </svg>
      <Controls>
        <Slider label="Amplitude" value={amp} min={2} max={16} onChange={setAmp} />
        <Slider label="Frequency" value={freq} min={2} max={12} onChange={setFreq} />
        <Slider label="Line gap" value={gap} min={8} max={24} onChange={setGap} />
        <Toggle label="Dashed" checked={broken} onChange={setBroken} />
      </Controls>
      <ValuesBar values={{ amp, freq, gap, broken }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 03 · Flowing lines — the wave field with a drifting dash offset.
 * ------------------------------------------------------------------ */

function FlowingWaves({ accent, accentDeep }: { accent: string; accentDeep: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [amp, setAmp] = useState(8);
  const [freq, setFreq] = useState(4); // ×0.01
  const [gap, setGap] = useState(15);
  const [dash, setDash] = useState(3);
  const [speed, setSpeed] = useState(6); // 1 slow → 10 fast

  const W = 600;
  const H = 260;
  const period = dash + dash * 1.5;
  const lines = useMemo(() => waveField(W, H, gap, amp, freq / 100, 0.6), [gap, amp, freq]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = Array.from(svg.querySelectorAll("path"));
    // Drift the dash by exactly one period for a seamless loop; alternate
    // direction per row and vary the duration so the field breathes.
    const base = 5200 - speed * 400;
    const anims = paths.map((p, i) =>
      p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: (i % 2 ? 1 : -1) * period }], {
        duration: base + i * 80,
        iterations: Infinity,
        easing: "linear",
      })
    );
    return () => anims.forEach((a) => a.cancel());
  }, [lines, speed, period]);

  return (
    <div className="space-y-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        className="w-full rounded-[14px] bg-[var(--color-bk-surface)]"
        style={{ height: H }}
      >
        {lines.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 2 ? accent : accentDeep}
            strokeWidth={0.85}
            strokeDasharray={`${dash} ${dash * 1.5}`}
            strokeLinecap="round"
            opacity={0.5}
          />
        ))}
      </svg>
      <Controls>
        <Slider label="Speed" value={speed} min={1} max={10} onChange={setSpeed} />
        <Slider label="Amplitude" value={amp} min={2} max={16} onChange={setAmp} />
        <Slider label="Frequency" value={freq} min={2} max={12} onChange={setFreq} />
        <Slider label="Line gap" value={gap} min={8} max={24} onChange={setGap} />
        <Slider label="Dash length" value={dash} min={1} max={8} onChange={setDash} />
      </Controls>
      <ValuesBar values={{ speed, amp, freq, gap, dash }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 04 · Engraving — canvas line-hatching of a glyph.
 * ------------------------------------------------------------------ */

function Engraving({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("$test");
  const [spacing, setSpacing] = useState(5);
  const [contrast, setContrast] = useState(3);
  const [base, setBase] = useState(2); // ×0.1
  const [wobble, setWobble] = useState(1); // ×0.1 of spacing

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const draw = () => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = 240;
      if (W <= 0) return;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.fillStyle = "#fff";
      octx.fillRect(0, 0, W, H);
      octx.fillStyle = "#000";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.font = `900 ${H * 0.82}px "Newsreader", serif`;
      octx.fillText(text.slice(0, 6) || "$", W / 2, H / 2 + H * 0.04);
      const data = octx.getImageData(0, 0, W, H).data;
      const darkAt = (x: number, y: number) => {
        const xi = Math.max(0, Math.min(W - 1, x | 0));
        const yi = Math.max(0, Math.min(H - 1, y | 0));
        return 1 - data[(yi * W + xi) * 4] / 255;
      };

      // Each row is a variable-thickness ribbon: a hairline in the background,
      // thickening where the glyph is dark. Legible — the classic engraving.
      const baseT = base * 0.1;
      const wob = wobble * 0.1 * spacing;
      ctx.fillStyle = accent;
      for (let y0 = spacing; y0 < H; y0 += spacing) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const t = baseT + darkAt(x, y0) * contrast;
          const yc = y0 + wob * darkAt(x, y0) * Math.sin(x * 0.4);
          if (x === 0) ctx.moveTo(x, yc - t / 2);
          else ctx.lineTo(x, yc - t / 2);
        }
        for (let x = W; x >= 0; x -= 2) {
          const t = baseT + darkAt(x, y0) * contrast;
          const yc = y0 + wob * darkAt(x, y0) * Math.sin(x * 0.4);
          ctx.lineTo(x, yc + t / 2);
        }
        ctx.closePath();
        ctx.fill();
      }
    };

    if (document.fonts?.ready) document.fonts.ready.then(draw);
    else draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [text, accent, spacing, contrast, base, wobble]);

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="w-full rounded-[14px] bg-[var(--color-bk-surface)]" style={{ height: 240 }} />
      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={6} className="bk-field w-24" placeholder="$" />
        {["$", "€", "£", "B", "¥"].map((g) => (
          <Button key={g} variant="outline" size="sm" onClick={() => setText(g)} className="px-3">
            {g}
          </Button>
        ))}
      </div>
      <Controls>
        <Slider label="Line spacing" value={spacing} min={4} max={12} onChange={setSpacing} />
        <Slider label="Contrast" value={contrast} min={2} max={12} onChange={setContrast} />
        <Slider label="Base weight" value={base} min={0} max={12} onChange={setBase} />
        <Slider label="Contour wobble" value={wobble} min={0} max={10} onChange={setWobble} />
      </Controls>
      <ValuesBar values={{ text, spacing, contrast, base, wobble }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 05 · Seal — the contained rosette medallion.
 * ------------------------------------------------------------------ */

function SealPlayground({
  accent,
  accentDeep,
  seal,
  onChange,
}: {
  accent: string;
  accentDeep: string;
  seal: SealConfig;
  onChange: (next: SealConfig) => void;
}) {
  const set = <K extends keyof SealConfig>(key: K, value: SealConfig[K]) => onChange({ ...seal, [key]: value });

  return (
    <div className="space-y-3">
      <div className="grid place-items-center rounded-[14px] bg-[var(--color-bk-surface)] py-8">
        <div className="h-[180px] w-[180px]">
          <GuillocheSeal accent={accent} accentDeep={accentDeep} petals={seal.petals} inner={seal.inner} pen={seal.pen} label={seal.label} />
        </div>
      </div>
      <p className="text-[12px] text-[var(--color-bk-muted)]">
        These controls also drive the “Verified seal” example in §01 — the two stay in sync.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={seal.label} onChange={(e) => set("label", e.target.value)} maxLength={3} className="bk-field w-20" placeholder="$" />
        {["$", "€", "£", "B", "✓"].map((g) => (
          <Button key={g} variant="outline" size="sm" onClick={() => set("label", g)} className="px-3">
            {g}
          </Button>
        ))}
      </div>
      <Controls>
        <Slider label="Petals" value={seal.petals} min={5} max={15} onChange={(v) => set("petals", v)} />
        <Slider label="Inner" value={seal.inner} min={3} max={8} onChange={(v) => set("inner", v)} />
        <Slider label="Pen offset" value={seal.pen} min={1} max={6} onChange={(v) => set("pen", v)} />
      </Controls>
      <ValuesBar values={{ ...seal }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 06 · Braided ribbon — the divider.
 * ------------------------------------------------------------------ */

function RibbonPlayground({ accent, accentDeep }: { accent: string; accentDeep: string }) {
  const [amp, setAmp] = useState(6);
  const [freq, setFreq] = useState(14);
  const [weight, setWeight] = useState(9); // ×0.1
  const W = 600;
  const H = 40;
  const w = weight * 0.1;

  return (
    <div className="space-y-3">
      <div className="grid place-items-center rounded-[14px] bg-[var(--color-bk-surface)] py-6">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-10 w-[90%]" aria-hidden>
          <path d={braid(W, H / 2, amp, freq, 0)} fill="none" stroke={accentDeep} strokeWidth={w} opacity={0.7} />
          <path d={braid(W, H / 2, amp, freq, Math.PI)} fill="none" stroke={accent} strokeWidth={w} opacity={0.7} />
        </svg>
      </div>
      <Controls>
        <Slider label="Amplitude" value={amp} min={2} max={16} onChange={setAmp} />
        <Slider label="Crossings" value={freq} min={4} max={28} onChange={setFreq} />
        <Slider label="Weight" value={weight} min={4} max={20} onChange={setWeight} />
      </Controls>
      <ValuesBar values={{ amp, freq, weight }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Compact controls
 * ------------------------------------------------------------------ */

function Controls({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
  );
}

/**
 * Live readout of a section's current settings + a copy button. Tune the
 * sliders, copy the JSON, and hand it back to bake in as the defaults.
 */
function ValuesBar({ values }: { values: Record<string, number | string | boolean> }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(values);
  return (
    <div className="flex items-center gap-2 pt-1">
      <code className="bk-scroll flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-[var(--color-bk-canvas)] px-2.5 py-1.5 text-[11px] text-[var(--color-bk-muted)]">
        {json}
      </code>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 px-3"
        onClick={() => {
          navigator.clipboard?.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </Button>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-bk-faint)]">
        {label} <span className="bk-num text-[var(--color-bk-ink)]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 h-1 w-full accent-[var(--bk-accent)]"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 self-end pb-1 text-[12px] text-[var(--color-bk-ink)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--bk-accent)]" />
      {label}
    </label>
  );
}

function Section({ n, title, desc, children }: { n: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="bk-enter p-6">
      <div className="mb-5">
        <div className="flex items-baseline gap-3">
          <span className="bk-num text-[15px] text-[var(--color-bk-faint)]">{n}</span>
          <CardLabel>{title}</CardLabel>
        </div>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-[var(--color-bk-muted)]">{desc}</p>
      </div>
      {children}
    </Card>
  );
}

export function BrandPatterns() {
  const { theme } = useBulgaChrome();
  const { accent, accentDeep } = theme;
  // One seal config, shared by the §01 example and the §05 playground so they
  // never drift apart.
  const [seal, setSeal] = useState<SealConfig>({ petals: 13, inner: 4, pen: 4, label: "$" });
  return (
    <div className="mt-8 space-y-6" style={{ maxWidth: 1000, margin: "32px auto 0" }}>
      <header className="bk-enter">
        <h2 className="text-[22px] tracking-tight" style={{ fontFamily: "var(--font-num)" }}>
          Guilloché &amp; engraving
        </h2>
        <p className="mt-1 text-[14px] text-[var(--color-bk-muted)]">
          The banknote line-work as brand texture. All of it follows the active accent.
        </p>
      </header>

      <Section
        n="01"
        title="Patterns in use"
        desc="How the texture reads once it's applied to real Bulga surfaces — the reference for where and how to reach for it in the product. Everything below is a knob for tuning the pieces shown here."
      >
        <InUse accent={accent} accentDeep={accentDeep} seal={seal} />
      </Section>

      <Section
        n="02"
        title="Wave field · procedural SVG"
        desc="The primary decorative backdrop. Engine-turned parallel lines that sit quietly behind cards, hero figures and empty states — subtle enough not to fight the content. Drop <GuillochePattern> into any relative card; tune density and dashing here."
      >
        <Playground accent={accent} accentDeep={accentDeep} />
      </Section>

      <Section
        n="03"
        title="Flowing lines · animated dashes"
        desc="The wave field in motion, for hero and landing moments where a little life helps. The dash offset drifts along each line for calm, flowing line-work — never a busy shader. Freezes under reduced-motion, so it's safe as a live background."
      >
        <FlowingWaves accent={accent} accentDeep={accentDeep} />
      </Section>

      <Section
        n="04"
        title="Engraving · canvas line-hatching"
        desc="Turns a glyph — or any image — into banknote-style line-work, thickening the lines where the source is dark. For denomination marks, an illustrated logo treatment, or a hero graphic. This is the most decorative/heavy option; use it as a focal point, not a background."
      >
        <Engraving accent={accent} />
      </Section>

      <Section
        n="05"
        title="Seal · rosette medallion"
        desc="A contained stamp mark, borrowing the wax-seal / mint-mark language of 'official, verified'. Intended for export-statement watermarks, achievement or verification badges (try the ✓), and small branded flourishes where an icon feels too plain."
      >
        <SealPlayground accent={accent} accentDeep={accentDeep} seal={seal} onChange={setSeal} />
      </Section>

      <Section
        n="06"
        title="Braided ribbon · divider"
        desc="The lightest-touch element: a woven sine border for separating sections, framing a statement header, or capping a card. Reach for this when a full field would be too much but a plain hairline too little."
      >
        <RibbonPlayground accent={accent} accentDeep={accentDeep} />
      </Section>
    </div>
  );
}
