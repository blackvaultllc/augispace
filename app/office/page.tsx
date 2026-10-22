import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfficeConsole } from "@/components/office-console";
import { SiteFooter, SiteHeader } from "@/components/augi-landing";
import { requireOwner } from "@/lib/office";

export const metadata: Metadata = { title: "President's Office" };

export const dynamic = "force-dynamic";

/**
 * President's Office — owner-only documentation & assurance center.
 * requireOwner() re-verifies the session and resolves the role from the
 * server-side registry on every request (fail-closed); this page is
 * convenience routing, not the authorization boundary.
 */
export default async function OfficePage() {
  const user = await requireOwner();
  if (!user) redirect("/sign-in?error=owner_only");

  return (
    <main className="office-page">
      <SiteHeader />
      <div className="admin-shell">
        <div className="inner-hero">
          <div className="inner-hero-copy">
            <span className="section-label">AUGI / PRESIDENT'S OFFICE</span>
            <h1>
              Documented, not
              <br />
              <span>decorated.</span>
            </h1>
            <p>
              Engineering records, security evidence, QA results, operational status, and the
              founder archive — every entry dated and traceable. Nothing here is invented.
            </p>
          </div>
          <div className="inner-hero-index">
            <strong>OFFICE</strong>
            <span>OWNER SESSION</span>
          </div>
        </div>
        <OfficeConsole email={user.email ?? ""} />
      </div>
      <SiteFooter />
    </main>
  );
}
