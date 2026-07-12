import { requireAdmin } from "@/lib/dashboard-context";
import { BrandKitView } from "@/components/otterfund/pages/brand-kit-view";

export default async function BrandKitPage() {
  await requireAdmin();
  return <BrandKitView />;
}
