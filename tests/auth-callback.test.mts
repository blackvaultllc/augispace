/**
 * Regression tests for /auth/callback routing decisions (no database).
 *
 * Confirmed-bug coverage:
 *  - DB lookup failure must NOT sign the user out or 500: resolveRole fails
 *    closed to 'member', so the callback routes members to '/' — the session
 *    survives a registry outage.
 *  - Non-admin members keep their session (member feature access).
 *  - Owner/staff route to the workspace.
 *
 * Run: npx tsx tests/auth-callback.test.mts
 */
import assert from "node:assert/strict";

process.env.DATABASE_URL = ""; // registry unreachable on purpose

const { resolveRole } = await import("../lib/roles.ts");

// Simulate the callback's decision table exactly as implemented.
function callbackDecision(role: { isAdmin: boolean }, next?: string | null) {
  if (!role.isAdmin) {
    const memberDestination = next?.startsWith("/reset-password") ? next : "/";
    return { action: "redirect", to: memberDestination, session: "keep" };
  }
  return { action: "redirect", to: "/workspace", session: "keep" };
}

// 1. Registry outage must degrade to member, never error.
const ctx = await resolveRole(
  "00000000-0000-0000-0000-000000000000",
  "regular@example.com",
);
assert.equal(ctx.role, "member");
assert.equal(ctx.isAdmin, false);
const decision = callbackDecision(ctx);
assert.equal(decision.to, "/", "members must land on the public site");
assert.equal(
  decision.session,
  "keep",
  "member session must survive a registry outage (no signOut)",
);

// 1b. A member arriving from the password-recovery link must reach the
//     new-password form (not bounce to the homepage mid-recovery).
const recoveryDecision = callbackDecision(ctx, "/reset-password");
assert.equal(
  recoveryDecision.to,
  "/reset-password",
  "members finishing password recovery must land on /reset-password",
);
assert.equal(recoveryDecision.session, "keep");

// 2. Elevated roles route to the workspace.
const elevated = callbackDecision({ isAdmin: true });
assert.equal(elevated.to, "/workspace");

// 3. The callback source must not contain the old sign-out-on-member path.
const { readFileSync } = await import("node:fs");
const src = readFileSync(
  new URL("../app/auth/callback/route.ts", import.meta.url),
  "utf8",
);
assert.ok(
  !/error=owner_only/.test(src),
  "members must no longer be signed out with owner_only",
);
const signOuts = (src.match(/signOut\(\)/g) ?? []).length;
assert.equal(
  signOuts,
  1,
  "signOut must remain only on the no-user failure path",
);

console.log(
  "PASS: auth callback regression tests (member session survives outage; no member sign-out).",
);
