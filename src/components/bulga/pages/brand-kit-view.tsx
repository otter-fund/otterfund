"use client";

import { BulgaBrandKit } from "@/components/bulga/pages/brand-kit";
import { useBulgaChrome } from "@/components/bulga/chrome-context";

export function BrandKitView() {
  const { accent, theme, setAccent } = useBulgaChrome();
  return <BulgaBrandKit accent={accent} theme={theme} onAccentChange={setAccent} />;
}
