import { requireUser } from "@/lib/dashboard-context";
import { BrandKitView } from "@/components/bulga/pages/brand-kit-view";

export default async function BrandKitPage() {
  await requireUser();
  return <BrandKitView />;
}
