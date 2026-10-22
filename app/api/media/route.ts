import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only media uploads for public page slots.
 * POST multipart/form-data: { file, placement }
 * Files go to the public `site-media` storage bucket; the placement row
 * records which slot the asset is shown in.
 */

const PLACEMENTS = [
  "truck_hero_video",
  "truck_hero_image",
  "live_counts_image",
] as const;

type Placement = (typeof PLACEMENTS)[number];

function isPlacement(value: string): value is Placement {
  return (PLACEMENTS as readonly string[]).includes(value);
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 64 * 1024; // 64 MB

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function isVideo(file: File) {
  return file.type.startsWith("video/");
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const role = await resolveRole(user.id, user.email);
  if (!role.isAdmin) {
    return NextResponse.json({ error: "Owner or staff only." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("media_assets")
    .select("placement, url, kind, updated_at");

  if (error) {
    return NextResponse.json(
      { error: "Media assets could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { assets: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const role = await resolveRole(user.id, user.email);
  if (!role.isAdmin) {
    return NextResponse.json({ error: "Owner or staff only." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Choose a file to upload." },
      { status: 400 },
    );
  }

  const placement = String(form.get("placement") ?? "");
  const file = form.get("file");

  if (!isPlacement(placement)) {
    return NextResponse.json(
      { error: "Unknown media slot." },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const video = isVideo(file);
  const image = isImage(file);
  if (!video && !image) {
    return NextResponse.json(
      { error: "Only image or video files are allowed." },
      { status: 400 },
    );
  }

  const wantsVideo = placement.endsWith("_video");
  if (wantsVideo && !video) {
    return NextResponse.json(
      { error: "That slot expects a video file (mp4, webm, or mov)." },
      { status: 400 },
    );
  }
  if (!wantsVideo && !image) {
    return NextResponse.json(
      { error: "That slot expects an image file (png, jpg, or webp)." },
      { status: 400 },
    );
  }
  const limit = wantsVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      {
        error: `File is too large. Maximum ${Math.round(limit / (1024 * 1024))} MB.`,
      },
      { status: 400 },
    );
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
    : video
      ? "mp4"
      : "png";
  const path = `${placement}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("site-media")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          "The upload failed. If this is the first upload, run the site-media migration so the storage bucket exists.",
      },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("site-media").getPublicUrl(path);

  const { error: upsertError } = await supabase
    .from("media_assets")
    .upsert(
      {
        placement,
        url: publicUrl,
        kind: video ? "video" : "image",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "placement" },
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "The upload succeeded but the slot could not be updated." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    kind: video ? "video" : "image",
    message: "Uploaded and live on the site.",
  });
}
