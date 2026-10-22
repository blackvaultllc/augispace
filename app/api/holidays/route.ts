import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/office";
import {
  listHolidays,
  upsertTheme,
  setHolidayEnabled,
  setOccurrenceDate,
  RADAR_MARKERS,
} from "@/lib/holidays";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only holiday calendar management (server-verified role). */
export async function GET() {
  const user = await requireOwner();
  if (!user)
    return NextResponse.json({ error: "Owner access only." }, { status: 403 });
  const holidays = await listHolidays().catch(() => []);
  return NextResponse.json(
    { holidays, markers: RADAR_MARKERS },
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
    radarMarker?: string;
    accentColor?: string;
    bannerEmoji?: string;
    pageCopy?: string;
    enabled?: boolean;
    date?: string;
  };
  if (!body?.action || typeof body.slug !== "string")
    return NextResponse.json(
      { error: "An action and holiday slug are required." },
      { status: 400 },
    );

  if (body.action === "save_theme") {
    const result = await upsertTheme({
      holidaySlug: body.slug,
      radarMarker: body.radarMarker ?? "default",
      accentColor: body.accentColor ?? "#8ce8dc",
      bannerEmoji: body.bannerEmoji ?? "",
      pageCopy: body.pageCopy ?? "",
      userId: user.id,
    });
    return result.ok
      ? NextResponse.json({ ok: true, message: "Theme saved." })
      : NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.action === "set_enabled") {
    const result = await setHolidayEnabled(
      body.slug,
      body.enabled === true,
      user.id,
    );
    return result.ok
      ? NextResponse.json({
          ok: true,
          message: body.enabled ? "Holiday enabled." : "Holiday disabled.",
        })
      : NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.action === "set_date") {
    const result = await setOccurrenceDate(body.slug, body.date ?? "", user.id);
    return result.ok
      ? NextResponse.json({ ok: true, message: "Date updated." })
      : NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
