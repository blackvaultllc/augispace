import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Awards & Achievements API — private, per-user records.
 *
 * Authorization model: Supabase auth session + RLS ("awards owner all")
 * enforce that a user only ever reads/writes their own rows. The server
 * additionally scopes every query by user.id, so enumeration of other
 * users' records is impossible even if RLS were misconfigured.
 *
 * Uploads go to the private `award-files` bucket under the user's own
 * folder; images are served via short-lived signed URLs (never public URLs).
 */

export const CATEGORIES = [
  "academic",
  "graduation",
  "athletics",
  "professional",
  "creative",
  "community",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const ALLOWED_DOC_TYPES = new Set(["application/pdf"]);

function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, 12);
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

/**
 * Content-type sniffing: never trust the client-declared MIME type alone.
 * Verify the declared type against the file's magic bytes for the formats
 * we accept. PDFs get a light structural check (%PDF- header).
 */
async function sniffKind(file: File): Promise<"image" | "document" | null> {
  const declared = file.type;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const startsWith = (bytes: number[]) => bytes.every((b, i) => head[i] === b);

  if (declared === "application/pdf") {
    const pdfHead = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const text = new TextDecoder().decode(pdfHead);
    return text.startsWith("%PDF-") ? "document" : null;
  }
  if (declared === "image/png" && startsWith([0x89, 0x50, 0x4e, 0x47]))
    return "image";
  if (declared === "image/jpeg" && startsWith([0xff, 0xd8, 0xff]))
    return "image";
  if (declared === "image/gif" && startsWith([0x47, 0x49, 0x46, 0x38]))
    return "image";
  if (declared === "image/webp") {
    // RIFF....WEBP
    const riff = startsWith([0x52, 0x49, 0x46, 0x46]);
    const webp = new Uint8Array(await file.slice(8, 12).arrayBuffer());
    const isWebp = [0x57, 0x45, 0x42, 0x50].every((b, i) => webp[i] === b);
    return riff && isWebp ? "image" : null;
  }
  // Declared type is not in our allowlist at all.
  if (ALLOWED_IMAGE_TYPES.has(declared) || ALLOWED_DOC_TYPES.has(declared))
    return null;
  return null;
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]/g, "_").slice(0, 120) || "file";
}

type AwardRow = {
  id: string;
  user_id: string;
  title: string;
  issuer: string | null;
  category: string;
  description: string | null;
  received_on: string | null;
  year_group: number | null;
  school_year: string | null;
  tags: string[];
  file_path: string | null;
  file_name: string | null;
  file_kind: "image" | "document" | null;
  created_at: string;
  updated_at: string;
};

async function signedUrlFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filePath: string | null,
) {
  if (!filePath) return null;
  const { data } = await supabase.storage
    .from("award-files")
    .createSignedUrl(filePath, 600);
  return data?.signedUrl ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data, error } = await supabase
    .from("awards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json(
      { error: "Awards could not be loaded." },
      { status: 500 },
    );

  const rows = (data ?? []) as AwardRow[];
  const awards = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      file_url: await signedUrlFor(supabase, row.file_path),
    })),
  );

  return NextResponse.json(
    { awards },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const title = cleanText(form.get("title"), 160);
  if (!title)
    return NextResponse.json(
      { error: "An award title is required." },
      { status: 400 },
    );

  const categoryRaw = form.get("category");
  const category = isCategory(categoryRaw) ? categoryRaw : "other";

  const receivedOn = cleanDate(form.get("received_on"));
  const yearGroupRaw = form.get("year_group");
  const yearGroup =
    typeof yearGroupRaw === "string" && /^\d{4}$/.test(yearGroupRaw)
      ? Number(yearGroupRaw)
      : null;

  const record = {
    user_id: user.id,
    title,
    issuer: cleanText(form.get("issuer"), 160),
    category,
    description: cleanText(form.get("description"), 2000),
    received_on: receivedOn,
    year_group: yearGroup,
    school_year: cleanText(form.get("school_year"), 40),
    tags: cleanTags(form.get("tags")),
    file_path: null as string | null,
    file_name: null as string | null,
    file_kind: null as "image" | "document" | null,
  };

  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large. Maximum ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
        },
        { status: 413 },
      );
    }
    const kind = await sniffKind(file);
    if (!kind) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PNG, JPEG, WebP, GIF, or PDF." },
        { status: 415 },
      );
    }
    const ext =
      kind === "document"
        ? "pdf"
        : (file.name.split(".").pop() ?? "img")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 5) || "img";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("award-files")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        {
          error:
            "The upload failed. The private award storage may not be configured yet (run the awards migration).",
        },
        { status: 500 },
      );
    }

    record.file_path = path;
    record.file_name = sanitizeFileName(file.name);
    record.file_kind = kind;
  }

  const { data: saved, error: saveError } = await supabase
    .from("awards")
    .insert(record)
    .select("*")
    .single();

  if (saveError || !saved) {
    // Best-effort cleanup so a failed DB write does not leave an orphan file.
    if (record.file_path)
      await supabase.storage
        .from("award-files")
        .remove([record.file_path])
        .catch(() => undefined);
    return NextResponse.json(
      { error: "The award could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      award: {
        ...saved,
        file_url: await signedUrlFor(supabase, saved.file_path),
      },
    },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json(
      { error: "A valid award id is required." },
      { status: 400 },
    );

  // Ownership is enforced both by the explicit user_id filter and by RLS.
  const { data: existing } = await supabase
    .from("awards")
    .select("id, file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Award not found." }, { status: 404 });

  if (existing.file_path) {
    await supabase.storage
      .from("award-files")
      .remove([existing.file_path])
      .catch(() => undefined);
  }

  const { error } = await supabase
    .from("awards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    return NextResponse.json(
      { error: "The award could not be deleted." },
      { status: 500 },
    );

  return NextResponse.json({ deleted: true });
}
