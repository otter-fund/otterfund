"use client";

import { OtterfundBrandKit } from "@/components/otterfund/pages/brand-kit";
import { BrandPatterns } from "@/components/otterfund/pages/brand-pattern";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";

export function BrandKitView() {
  const { accent, theme, setAccent } = useOtterfundChrome();
  return (
    <>
      <OtterfundBrandKit accent={accent} theme={theme} onAccentChange={setAccent} />
      <BrandPatterns />
    </>
  );
}
