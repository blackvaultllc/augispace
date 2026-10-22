import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Award file proxy: serves the owner's own attachment through a short-lived
 * signed URL from the private bucket. Never public, never another user's.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { error: "A valid award id is required." },
      { status: 400 },
    );
  }

  // Ownership enforced by the explicit user_id filter (and RLS as backstop).
  const { data: row } = await supabase
    .from("awards")
    .select("file_path, file_name, file_kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!row?.file_path)
    return NextResponse.json({ error: "File not found." }, { status: 404 });

  const { data: signed } = await supabase.storage
    .from("award-files")
    .createSignedUrl(row.file_path, 600);

  if (!signed?.signedUrl)
    return NextResponse.json(
      { error: "The file could not be opened." },
      { status: 500 },
    );

  // Redirect to the short-lived signed URL; never a public URL.
  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
