import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

// Default social share card for every route (Open Graph + Twitter). Rendered at
// build time by next/og (Satori), so styling stays inline and colours are hex
// (Satori doesn't parse oklch) — a deep-evergreen approximation of the brand
// banknote panel with the otterfund wordmark, tagline, and pitch.

export const alt = "otterfund: the calm, AI-powered budgeting app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(158deg, #17452f 0%, #103826 52%, #0b2519 100%)",
          color: "#f5f3ec",
          fontFamily: "serif",
        }}
      >
        {/* wordmark + dot lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "#e8734a",
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {SITE_NAME}
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              fontSize: 88,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              maxWidth: 940,
            }}
          >
            {SITE_TAGLINE}
            <span style={{ color: "#9fe3ba", fontStyle: "italic" }}>.</span>
          </div>
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.35,
              color: "#bfe0cb",
              maxWidth: 900,
              fontFamily: "sans-serif",
            }}
          >
            The free AI budgeting app that splits every dollar across Needs,
            Wants, and Savings, and helps you save.
          </div>
        </div>

        {/* footer keyword row */}
        <div
          style={{
            display: "flex",
            gap: 28,
            fontSize: 22,
            color: "#8fbfa4",
            fontFamily: "sans-serif",
          }}
        >
          <span>Budgeting</span>
          <span>·</span>
          <span>Save money</span>
          <span>·</span>
          <span>50/30/20</span>
          <span>·</span>
          <span>AI insights</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
