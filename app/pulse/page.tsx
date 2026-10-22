import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PulseDashboard } from "@/components/pulse-dashboard";
import { PulseEditor } from "@/components/pulse-editor";
import { SiteFooter, SiteHeader } from "@/components/augi-landing";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Infinity Pulse — trend intelligence",
};

export const dynamic = "force-dynamic";

/**
 * Infinity Pulse — member trend dashboard + owner/staff review desk.
 * Server verifies the session; the review desk renders for everyone but the
 * API re-checks roles on every action (the UI is not the boundary).
 */
export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/pulse");

  const role = await resolveRole(user.id, user.email);

  return (
    <main className="pulse-page">
      <SiteHeader />
      <div className="admin-shell">
        <div className="inner-hero">
          <div className="inner-hero-copy">
            <span className="section-label">AUGI / INFINITY PULSE</span>
            <h1>Trends, verified.</h1>
            <p>
              Live trend observations with named sources, retrieval timestamps,
              and a human approval gate before anything reaches the public
              article hub.
            </p>
          </div>
          <div className="inner-hero-index">
            <strong>PULSE</strong>
            <span>{role.isAdmin ? "REVIEW ACCESS" : "MEMBER ACCESS"}</span>
          </div>
        </div>

        <PulseDashboard canDraft={role.isAdmin} />
        {role.isAdmin && <PulseEditor />}
      </div>
      <SiteFooter />
    </main>
  );
}
