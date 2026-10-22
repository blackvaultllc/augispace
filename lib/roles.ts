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
 *
 * Fail-closed: if the registry is unreachable, the caller is treated as a plain
 * member (never elevated). Database outages must not grant privileges, and this
 * function must never throw so callers can redirect instead of returning 500.
 */
export async function resolveRole(
  userId: string,
  email: string | null | undefined,
): Promise<RoleContext> {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (isOwnerEmail(normalizedEmail)) {
    // Self-heal: make sure the owner row exists. The owner email is the
    // configured bootstrap identity; a registry write failure here does not
    // change the decision (the owner is the owner by configuration).
    await pool
      .query(
        `insert into app_users (user_id, email, role) values ($1, $2, 'owner')
       on conflict (user_id) do update set role = 'owner', email = $2, updated_at = now()`,
        [userId, normalizedEmail],
      )
      .catch(() => undefined);
    return { userId, email: normalizedEmail, role: "owner", isAdmin: true };
  }

  try {
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
  } catch (error) {
    console.error("[roles] app_users lookup failed; failing closed as member", error);
    return { userId, email: normalizedEmail, role: "member", isAdmin: false };
  }
}

/**
 * Claim a pending staff invite for this user, if one matches their email.
 * Safe to call on every sign-in; returns true when a pending invite was claimed.
 */
export async function claimStaffInvite(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return false;
  try {
    const result = await pool.query<{ role: AppRole }>(
      `with claimed as (
       update staff_invites
       set status = 'claimed', claimed_at = now()
       where email = $2 and status = 'pending'
       returning role
     )
     insert into app_users (user_id, email, role)
     select $1, $2, role from claimed
     on conflict (user_id) do update set role = excluded.role, updated_at = now()
     returning role`,
      [userId, normalizedEmail],
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error("[roles] staff invite claim failed; continuing as existing role", error);
    return false;
  }
}

/**
 * Set a user's role directly (owner/staff admin action).
 * Throws on failure so the admin API can report the error instead of
 * silently pretending the role change succeeded.
 */
export async function setUserRole(userId: string, role: AppRole) {
  await pool.query(
    `insert into app_users (user_id, email, role)
     select u.id, u.email, $2 from auth.users u where u.id = $1
     on conflict (user_id) do update set role = $2, updated_at = now()`,
    [userId, role],
  );
}
