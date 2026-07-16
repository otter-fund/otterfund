// Dev helper — create a pre-confirmed test user, or reset one back to
// not-onboarded, so you can walk the onboarding flow (incl. the free route).
//
// Writes to the HOSTED Supabase project in .env — use only with test emails.
// Not imported anywhere; safe to delete. Talks to the Supabase Auth-admin and
// REST endpoints directly with fetch (no SDK), so it runs on Node 18+ without
// the realtime/WebSocket requirement of @supabase/supabase-js. Run from the
// project root so .env resolves:
//
//   node scripts/dev-test-user.mjs create <email> <password> [name]
//   node scripts/dev-test-user.mjs reset  <email>
//   node scripts/dev-test-user.mjs delete <email>
//
// create : makes an email-confirmed auth user (a Postgres trigger auto-creates
//          the profile row with onboardingDone=false). If the user already
//          exists, it re-confirms them and resets the password.
// reset  : restores the full first-run state — onboardingDone=false, the tour
//          re-armed (tourCompletedAt=null), AND the data onboarding creates
//          (categories, budgets, accounts, subscriptions, bills, …) wiped.
//          Without the wipe, re-walking onboarding collides on the existing
//          budgets (unique userId+category+month+year) and errors; without the
//          tour re-arm, the first-run guide never shows again.
// delete : removes the auth user, then the profile row (the auth→profile FK is
//          NOT ON DELETE CASCADE, so the profile must be deleted explicitly).

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from the project root regardless of the current working directory.
dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL || !SECRET) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

const [cmd, email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ") || "Test Otter";

function usage() {
  console.error(
    "Usage:\n" +
      "  node scripts/dev-test-user.mjs create <email> <password> [name]\n" +
      "  node scripts/dev-test-user.mjs reset  <email>\n" +
      "  node scripts/dev-test-user.mjs delete <email>",
  );
  process.exit(1);
}

const authHeaders = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...authHeaders, ...init.headers } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.msg || body?.message || body?.error_description || body?.error || text || res.statusText;
    const err = new Error(`${res.status} ${msg}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// GoTrue has no "get by email" admin call, so page through /admin/users.
async function findByEmail(target) {
  const needle = target.toLowerCase();
  for (let page = 1; page <= 25; page++) {
    const body = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = body?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === needle);
    if (hit) return hit;
    if (users.length < 200) break; // last page
  }
  return null;
}

// Password policy from supabase/config.toml: >=12 chars, upper+lower+digit+symbol.
function warnWeakPassword(pw) {
  const ok =
    pw.length >= 12 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  if (!ok) {
    console.warn(
      "!  Password may be rejected — needs 12+ chars with upper, lower, digit, and symbol (e.g. TestOtter#2026).",
    );
  }
}

// Restore the pre-first-run flags via PostgREST (the secret key bypasses RLS):
// onboardingDone=false replays the wizard, and tourCompletedAt=null re-arms the
// first-run product tour so it auto-starts again on the next /dashboard load.
async function resetFlag(userId, targetLabel, { quiet } = {}) {
  const rows = await api(`/rest/v1/User?id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ onboardingDone: false, tourCompletedAt: null }),
  });
  if (!rows?.length) {
    if (!quiet) console.warn(`!  No profile row found for ${targetLabel} — the trigger may not have created it yet.`);
  } else if (!quiet) {
    console.log(`✔  Reset onboardingDone=false + re-armed the first-run tour for ${targetLabel}. Reload /onboarding.`);
  }
}

async function create() {
  if (!email || !password) usage();
  warnWeakPassword(password);

  let user;
  try {
    user = await api(`/auth/v1/admin/users`, {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
    });
    console.log(`✔  Created confirmed user: ${email} (id ${user.id})`);
  } catch (e) {
    // Already registered → re-confirm + reset the password so you can sign in.
    if (e.status !== 422 && e.status !== 409) throw e;
    const existing = await findByEmail(email);
    if (!existing) throw e;
    user = await api(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ email_confirm: true, password, user_metadata: { name } }),
    });
    console.log(`✔  Existing user re-confirmed and password reset: ${email} (id ${user.id})`);
  }

  // Trigger creates the profile with onboardingDone=false, but if the user
  // pre-existed and already onboarded, reset the flag too.
  await resetFlag(user.id, email, { quiet: true });
  console.log("→  Sign in at /login; you'll be routed to /onboarding.");
}

// The user's onboarding-created + derived data, in FK-safe order (children
// before the accounts/categories/goals they reference). Wiped on reset so
// re-walking onboarding starts clean instead of colliding on existing rows.
const OWNED_TABLES_FK_ORDER = [
  "Transaction",
  "Budget",
  "GoalAllocation",
  "Bill",
  "Subscription",
  "Insight",
  "BankStatement",
  "Investment",
  "Account",
  "Goal",
  "Category",
];

// Delete every owned row for the user, table by table. Best-effort per table: a
// missing table (schema drift) or a benign empty delete must not abort the reset.
async function wipeUserData(userId) {
  for (const table of OWNED_TABLES_FK_ORDER) {
    try {
      await api(`/rest/v1/${table}?userId=eq.${userId}`, { method: "DELETE" });
    } catch (e) {
      console.warn(`!  Skipped ${table}: ${e.message}`);
    }
  }
  console.log("✔  Cleared onboarding data (categories, budgets, accounts, subscriptions, bills, …).");
}

async function reset() {
  if (!email) usage();
  const user = await findByEmail(email);
  if (!user) {
    console.error(`No auth user found for ${email}`);
    process.exit(1);
  }
  await wipeUserData(user.id);
  await resetFlag(user.id, email);
}

async function del() {
  if (!email) usage();
  const user = await findByEmail(email);
  if (!user) {
    console.error(`No auth user found for ${email}`);
    process.exit(1);
  }
  await api(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
  // The auth→profile FK is NOT ON DELETE CASCADE, so removing the auth user
  // leaves the profile row orphaned — and since User.email is unique, that
  // orphan blocks re-registering the same email. Delete it explicitly (this
  // cascades the user's owned data via the User table's own FKs).
  await api(`/rest/v1/User?id=eq.${user.id}`, { method: "DELETE" });
  console.log(`✔  Deleted user + profile: ${email} (id ${user.id})`);
}

try {
  if (cmd === "create") await create();
  else if (cmd === "reset") await reset();
  else if (cmd === "delete") await del();
  else usage();
} catch (e) {
  console.error("Failed:", e.message || e);
  process.exit(1);
}
