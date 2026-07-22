-- ─────────────────────────────────────────────────────────────────────────────
-- RLS lockdown — follow-up for the messaging tables, matching
-- 20260701000200_rls_lockdown.sql and 20260709120000_rls_lockdown_new_tables.sql.
--
-- STATUS: already applied to the live database on 2026-07-22 and verified (the
-- publishable/anon key now gets HTTP 401 on both tables). Nothing to run now.
-- Kept as the record, and to re-apply only when provisioning a FRESH database,
-- after `prisma migrate deploy`. Idempotent and safe to re-run:
--   psql "$DIRECT_URL" -f supabase/migrations/20260722130000_rls_lockdown_messaging.sql
--
-- WHY THIS EXISTS
-- Prisma created MessagingConnection + MessagingEvent, and Supabase's default
-- privileges hand `anon`/`authenticated` (the browser-shipped publishable key, via
-- the auto-exposed PostgREST Data API at /rest/v1) FULL CRUD on any new public
-- table. Verified before this ran: GET /rest/v1/MessagingConnection returned 200 to
-- the anon key, while /rest/v1/User (locked down earlier) returned 401. That gap
-- was exploitable: MessagingConnection holds linkToken (a bearer token for account
-- linking) and providerChatId (a phone number).
--
-- THE MODEL (unchanged — see 20260701000200 for the full rationale)
-- All data access is Prisma over the privileged owner role (BYPASSRLS), so it is
-- unaffected. Per-user scoping is enforced in the resolvers (where: { userId }).
-- We apply the same two independent locks against the public API roles: enable RLS
-- (no permissive policy → deny all) and revoke the blanket anon/authenticated
-- grants. We do NOT FORCE row level security (that would subject the owner too and
-- break Prisma), and add NO auth.uid() policies (the Data API is not a supported
-- access path here, so per-user policies would be dead, untested surface).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public."MessagingConnection" enable row level security;
revoke all on public."MessagingConnection" from anon, authenticated;

alter table public."MessagingEvent" enable row level security;
revoke all on public."MessagingEvent" from anon, authenticated;
