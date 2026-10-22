import { NextResponse } from "next/server";
import { getLiveThreatFeed } from "@/lib/live-threat-feed";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const feed = await getLiveThreatFeed();
    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "The verified threat feed is temporarily unavailable. Try again shortly.",
      },
      { status: 503 },
    );
  }
}
