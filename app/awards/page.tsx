import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "./awards.css";
import { AwardsWorkspace } from "@/components/awards-workspace";
import { SiteHeader, SiteFooter } from "@/components/augi-landing";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Awards & Achievements" };

export const dynamic = "force-dynamic";

/**
 * Free, private awards workspace for any signed-in user.
 * Server-side session check; RLS + per-user scoping protect every record.
 */
export default async function AwardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/awards");

  const { data: rows, error } = await supabase
    .from("awards")
    .select("*")
    .eq("user_id", user.id)
    .order("received_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error("Awards could not be loaded.");

  const awards = (rows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    issuer: (row.issuer as string | null) ?? "",
    category: row.category as string,
    description: (row.description as string | null) ?? "",
    receivedOn: (row.received_on as string | null) ?? "",
    yearGroup: (row.year_group as number | null) ?? null,
    schoolYear: (row.school_year as string | null) ?? "",
    tags: (row.tags as string[] | null) ?? [],
    fileName: (row.file_name as string | null) ?? "",
    fileKind: (row.file_kind as "image" | "document" | null) ?? null,
    createdAt: row.created_at as string,
  }));

  return (
    <main className="augi-site">
      <SiteHeader />
      <div className="site-frame">
        <div className="inner-hero">
          <div className="inner-hero-copy">
            <span className="section-label">
              AUGI / AWARDS &amp; ACHIEVEMENTS
            </span>
            <h1>
              Your record
              <br />
              <span>of accomplishment.</span>
            </h1>
            <p>
              A private, free timeline of everything you have earned —
              certificates, trophies, milestones, and moments worth keeping.
              Only you can see these records.
            </p>
          </div>
          <div className="inner-hero-index">
            <strong>{awards.length}</strong>
            <span>{awards.length === 1 ? "ACHIEVEMENT" : "ACHIEVEMENTS"}</span>
          </div>
        </div>
        <AwardsWorkspace initialAwards={awards} />
      </div>
      <SiteFooter />
    </main>
  );
}
