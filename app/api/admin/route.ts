import { NextResponse, type NextRequest } from "next/server";
import { pool } from "@/lib/db";
import {
  setIntegrationSecret,
  deleteIntegrationSecret,
  getIntegrationStatus,
  isIntegrationKey,
} from "@/lib/integration-secrets";
import { resolveRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only back-office API:
 *  - staff invites and role changes
 *  - integration secret management (values are encrypted at rest, never returned)
 */

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  const role = await resolveRole(user.id, user.email);
  if (role.role !== "owner")
    return {
      error: NextResponse.json(
        { error: "Owner access only." },
        { status: 403 },
      ),
    };
  return { userId: user.id };
}

export async function GET() {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const [staff, invites, statuses] = await Promise.all([
    pool.query<{
      user_id: string;
      email: string;
      role: string;
      created_at: string;
    }>(
      `select user_id, email, role, created_at from app_users where role in ('owner','staff') order by created_at desc`,
    ),
    pool.query<{
      id: string;
      email: string;
      role: string;
      status: string;
      created_at: string;
    }>(
      `select id, email, role, status, created_at from staff_invites order by created_at desc limit 50`,
    ),
    Promise.all([getIntegrationStatus("abuseipdb_api_key")]),
  ]);

  return NextResponse.json(
    {
      staff: staff.rows,
      invites: invites.rows,
      integrations: [
        {
          key: "abuseipdb_api_key",
          label: "AbuseIPDB API key",
          ...statuses[0],
        },
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const body = (await request.json().catch(() => null)) as null | {
    action?: string;
    email?: string;
    role?: string;
    userId?: string;
    key?: string;
    value?: string;
  };
  if (!body?.action)
    return NextResponse.json(
      { error: "An action is required." },
      { status: 400 },
    );

  if (body.action === "invite_staff") {
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    const role = body.role === "member" ? "member" : "staff";
    await pool.query(
      `insert into staff_invites (email, role, invited_by) values ($1, $2, $3)
       on conflict (email) do update set role = excluded.role, status = 'pending', invited_by = excluded.invited_by, claimed_at = null`,
      [email, role, guard.userId],
    );
    return NextResponse.json({
      ok: true,
      message: `${email} can now sign up and will be granted ${role} access.`,
    });
  }

  if (body.action === "revoke_invite") {
    const email = (body.email ?? "").trim().toLowerCase();
    await pool.query(
      `update staff_invites set status = 'revoked' where email = $1`,
      [email],
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_role") {
    const userId = body.userId;
    const role = body.role;
    if (!userId || !["owner", "staff", "member"].includes(role ?? "")) {
      return NextResponse.json(
        { error: "A valid user and role are required." },
        { status: 400 },
      );
    }
    await pool.query(
      `update app_users set role = $2, updated_at = now() where user_id = $1`,
      [userId, role],
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "save_integration") {
    const key = body.key ?? "";
    const value = body.value ?? "";
    if (!isIntegrationKey(key))
      return NextResponse.json(
        { error: "Unknown integration." },
        { status: 400 },
      );
    if (!value.trim())
      return NextResponse.json(
        { error: "Paste the API key value." },
        { status: 400 },
      );
    await setIntegrationSecret(key, value, guard.userId);
    return NextResponse.json({
      ok: true,
      message: "Key stored encrypted. It never leaves the server.",
    });
  }

  if (body.action === "delete_integration") {
    const key = body.key ?? "";
    if (!isIntegrationKey(key))
      return NextResponse.json(
        { error: "Unknown integration." },
        { status: 400 },
      );
    await deleteIntegrationSecret(key);
    return NextResponse.json({
      ok: true,
      message: "Key removed from server storage.",
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
