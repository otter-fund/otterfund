import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMaintenanceMode, maintenanceUnlockable } from "@/lib/maintenance";
import { MaintenanceView } from "./maintenance-view";

export const metadata: Metadata = {
  title: "Under maintenance",
  robots: { index: false, follow: false },
};

// The proxy rewrites every request here while maintenance mode is on. If the
// flag is off, there is nothing to gate, so a direct visit goes home.
export default function MaintenancePage() {
  if (!isMaintenanceMode()) redirect("/");
  return <MaintenanceView unlockable={maintenanceUnlockable()} />;
}
