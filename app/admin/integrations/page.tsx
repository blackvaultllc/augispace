import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminIntegrations } from "@/components/admin-integrations";
import { SiteFooter, SiteHeader } from "@/components/augi-landing";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";

export const metadata: Metadata = { title: "Admin / Integrations" };
export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  // Server-enforced authorization: session + role registry (fail-closed).
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in?next=/admin/integrations");
  const role = await resolveRole(user.id, user.email);
  if (role.role !== "owner") redirect("/sign-in?error=owner_only");

  return (
    <main className="admin-page">
      <SiteHeader />
      <AdminIntegrations />
      <SiteFooter />
    </main>
  );
}
