import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import DesignSystemShell from "@/components/design-system-shell";

/**
 * /design-system — the live design-token catalog. Dev-only: redirects
 * non-developers to /settings. The page itself is a thin server gate; all
 * actual rendering happens in DesignSystemShell so the live editor can use
 * useState/useEffect.
 */
export default async function DesignSystemPage() {
  const { profile } = await requireSession();
  if (!profile?.is_developer) redirect("/settings");

  return <DesignSystemShell />;
}
