-- One-time backfill: create public."User" profile rows for any auth.users that
-- were created BEFORE the on_auth_user_created trigger existed
-- (20260701000100_auth_profile_trigger.sql). Mirrors handle_new_user().
--
-- Idempotent and safe on a fresh DB: `on conflict do nothing`, and a fresh DB
-- has no pre-existing auth users, so this simply inserts nothing there.
insert into public."User" (id, name, email, currency, "onboardingDone", "createdAt", "updatedAt")
select u.id::text,
       coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
       u.email,
       'CAD',
       false,
       now(),
       now()
from auth.users u
on conflict (id) do nothing;
