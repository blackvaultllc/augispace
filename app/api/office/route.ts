import { NextResponse, type NextRequest } from "next/server";
import {
  listDocuments,
  listFindings,
  listRevisions,
  requireOwner,
  saveDocument,
  seedOfficeContent,
  updateFindingStatus,
} from "@/lib/office";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * President's Office API — owner only, direct-pool access, RLS-deny tables.
 * The seed runs lazily on first load so a fresh database populates itself
 * without a separate seeding step.
 */
export async function GET() {
  const user = await requireOwner();
  if (!user)
    return NextResponse.json({ error: "Owner access only." }, { status: 403 });

  await seedOfficeContent();

  const [documents, findings] = await Promise.all([
    listDocuments(),
    listFindings(),
  ]);
  return NextResponse.json(
    { documents, findings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const user = await requireOwner();
  if (!user)
    return NextResponse.json({ error: "Owner access only." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as null | {
    action?: string;
    slug?: string;
    body?: string;
    changeNote?: string;
    documentId?: string;
    id?: string;
    status?: string;
    note?: string;
  };
  if (!body?.action)
    return NextResponse.json(
      { error: "An action is required." },
      { status: 400 },
    );

  if (body.action === "save_document") {
    if (typeof body.slug !== "string" || typeof body.body !== "string")
      return NextResponse.json(
        { error: "A document slug and body are required." },
        { status: 400 },
      );
    if (body.body.length > 100_000)
      return NextResponse.json(
        { error: "The document is too large." },
        { status: 413 },
      );
    const result = await saveDocument({
      slug: body.slug,
      body: body.body,
      changeNote:
        typeof body.changeNote === "string" && body.changeNote.trim()
          ? body.changeNote
          : "edited via President's Office",
      userId: user.id,
    });
    return result.ok
      ? NextResponse.json({
          ok: true,
          message: `Saved as a new version. The previous version is preserved.`,
        })
      : NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.action === "list_revisions") {
    if (
      typeof body.documentId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.documentId)
    )
      return NextResponse.json(
        { error: "A valid document id is required." },
        { status: 400 },
      );
    const revisions = await listRevisions(body.documentId);
    return NextResponse.json({ revisions });
  }

  if (body.action === "set_finding_status") {
    if (
      typeof body.id !== "string" ||
      typeof body.status !== "string" ||
      !["open", "mitigated", "closed", "accepted_risk"].includes(body.status)
    )
      return NextResponse.json(
        { error: "A valid finding id and status are required." },
        { status: 400 },
      );
    const result = await updateFindingStatus({
      id: body.id,
      status: body.status as "open" | "mitigated" | "closed" | "accepted_risk",
      note: typeof body.note === "string" ? body.note : "",
      userId: user.id,
    });
    return result.ok
      ? NextResponse.json({
          ok: true,
          message: "Finding status recorded with change history.",
        })
      : NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
