-- ─────────────────────────────────────────────────────────────────────────────
-- RLS lockdown — follow-up to 20260701000200_rls_lockdown.sql.
--
-- RUN THIS *AFTER* `prisma migrate deploy` (it locks down the tables Prisma made).
-- Idempotent — safe to re-run. Apply in the Supabase SQL Editor or via psql:
--   psql "$DIRECT_URL" -f supabase/migrations/20260709120000_rls_lockdown_new_tables.sql
--
-- WHY THIS EXISTS
-- The original lockdown used a hardcoded table list. Prisma migrations since then
-- added Merchant, AdvisorConversation, AdvisorMessage, Investment and AiUsageEvent,
-- which were never locked down — so `anon`/`authenticated` (the browser-shipped
-- publishable key, via the auto-exposed PostgREST Data API at /rest/v1) retained
-- FULL CRUD on them, and Supabase's linter flagged "RLS Disabled in Public".
--
-- THE MODEL (unchanged — see 20260701000200 for the full rationale)
-- All data access is Prisma over the privileged `postgres` role, which OWNS these
-- tables and has BYPASSRLS, so it is unaffected. Per-user scoping is enforced in
-- the GraphQL resolvers (where: { userId }). We apply the same two independent
-- locks against the public API roles: enable RLS (no permissive policy → deny all)
-- and revoke the blanket anon/authenticated grants.
--
-- Merchant is a cross-user cache with no `userId`; that is fine — the Data API is
-- not an access path here, so denying it entirely is correct (Prisma still reads
-- and writes it via the owner role).
--
-- We do NOT FORCE row level security (that would subject the owner too and break
-- Prisma), and add NO auth.uid() policies — the Data API is not a supported path,
-- so per-user policies would be dead, untested surface.
--
-- This runs over EVERY base table in `public` (not a hardcoded list) so any future
-- Prisma table is locked down automatically and this linter finding cannot recur.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r' -- ordinary base tables only (skip views/sequences)
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon, authenticated;', t);
  end loop;
end
$$;
