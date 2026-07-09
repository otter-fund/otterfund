"use client";

// Merchant avatar tile: shows the company logo (Google favicon keyed on the
// merchant's domain) and falls back to a themed letter tile when there's no
// domain or the image fails to load. Never renders a broken image.

import { useState } from "react";
import { logoUrl } from "@/lib/merchant/logo";

interface MerchantAvatarProps {
  name: string;
  domain?: string | null;
  /** Fallback tile background (theme-derived tint). */
  bg: string;
  /** Fallback letter colour. */
  ink: string;
  size?: number;
}

export function MerchantAvatar({ name, domain, bg, ink, size = 38 }: MerchantAvatarProps) {
  const src = logoUrl(domain, 64);
  const [failed, setFailed] = useState(false);
  const showLogo = src && !failed;

  // The logo fills the whole tile edge-to-edge (no padding, object-fit:cover).
  // The letter fallback keeps the themed tint background.
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: showLogo ? "#fff" : bg,
        color: ink,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
      }}
    >
      {showLogo ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
