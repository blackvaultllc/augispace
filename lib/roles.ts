import { pool } from "@/lib/db";
import { isOwnerEmail } from "@/lib/plans";

export type AppRole = "owner" | "staff" | "member";

export type RoleContext = {
  userId: string;
  email: string;
  role: AppRole;
  isAdmin: boolean;
};

/**
 * Resolve the caller's role from the app_users registry.
 * The owner email always resolves to 'owner' even before a row exists.
 */
export async function resolveRole(
  userId: string,
  email: string | null | undefined,
): Promise<RoleContext> {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (isOwnerEmail(normalizedEmail)) {
    // Self-heal: make sure the owner row exists.
    await pool
      .query(
        `insert into app_users (user_id, email, role) values ($1, $2, 'owner')
       on conflict (user_id) do update set role = 'owner', email = $2, updated_at = now()`,
        [userId, normalizedEmail],
      )
      .catch(() => undefined);
    return { userId, email: normalizedEmail, role: "owner", isAdmin: true };
  }

  const result = await pool.query<{ role: AppRole }>(
    "select role from app_users where user_id = $1",
    [userId],
  );
  const role = (result.rows[0]?.role ?? "member") as AppRole;
  return {
    userId,
    email: normalizedEmail,
    role,
    isAdmin: role === "owner" || role === "staff",
  };
}

/** Claim a pending staff invite for this user, if one matches their email. */
export async function claimStaffInvite(
  userId: string,
  email: string | null | undefined,
) {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return;
  await pool
    .query(
      `with claimed as (
       update staff_invites
       set status = 'claimed', claimed_at = now()
       where email = $2 and status = 'pending'
       returning role
     )
     insert into app_users (user_id, email, role)
     select $1, $2, role from claimed
     on conflict (user_id) do update set role = excluded.role, updated_at = now()`,
      [userId, normalizedEmail],
    )
    .catch(() => undefined);
}

/** Set a user's role directly (owner/staff admin action). */
export async function setUserRole(userId: string, role: AppRole) {
  await pool
    .query(
      `insert into app_users (user_id, email, role)
     select id, email, $2 from app_users where user_id = $1
     on conflict (user_id) do update set role = $2, updated_at = now()`,
      [userId, role],
    )
    .catch(() => undefined);
}
