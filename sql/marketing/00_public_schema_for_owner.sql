-- ---------------------------------------------------------------------------
-- ONLY if `01_inventory_units.sql` fails with:
--   ERROR: 42501: permission denied for schema public
--
-- In Supabase Dashboard → SQL Editor: set **Role** to **postgres** (not anon
-- or authenticated). Run this file once, then run `01` again.
--
-- Do NOT use `ALTER SCHEMA public OWNER ...` here: unless your session already
-- owns `public`, Postgres returns: must be owner of schema public (42501).
-- ---------------------------------------------------------------------------

-- Who owns `public`? (read-only; helps if you still get permission errors.)
select nspname as schema, pg_catalog.pg_get_userbyid(nspowner) as owner
from pg_catalog.pg_namespace
where nspname = 'public';

-- Restore CREATE for the `postgres` role (safe when run as superuser / schema owner).
grant usage, create on schema public to postgres;
