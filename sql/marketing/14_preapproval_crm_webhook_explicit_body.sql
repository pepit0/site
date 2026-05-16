-- Marketing → CRM: replace generic supabase_functions.http_request trigger with an explicit body.
-- Run on the **marketing** Supabase project as `postgres`.
--
-- Your current trigger passes the literal `'{}'` as the 4th argument to `http_request`. Supabase
-- docs imply the platform may still attach row data when the trigger is created a certain way;
-- if the CRM ingest ever sees an empty or sparse `record`, use this migration so the POST body
-- is always the same shape as Database Webhooks:
--   { "type":"INSERT", "table":"...", "schema":"public", "record": { ...full NEW row... }, "old_record": null }
--
-- Before running:
-- 1) Edit v_url and v_secret below (or switch to vault — see comment at bottom).
-- 2) Rotate `X-Marketing-Webhook-Secret` if it was ever pasted into chat or committed.
-- 3) Ensure extension pg_net exists (Dashboard → Database → Extensions → pg_net), or:
--    create extension if not exists pg_net with schema extensions;

drop trigger if exists "preapproval-to-crm" on public.preapproval_leads;

create or replace function public.notify_preapproval_lead_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  -- TODO: set your CRM Edge function URL (same project you already targeted).
  v_url text := 'https://izgehybhisycbhalkbub.supabase.co/functions/v1/ingest-marketing-preapproval';
  -- TODO: must match CRM Edge env MARKETING_WEBHOOK_SECRET
  v_secret text := 'YOUR_WEBHOOK_SECRET';
begin
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Marketing-Webhook-Secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', null::jsonb
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

comment on function public.notify_preapproval_lead_to_crm() is
  'POSTs a Database Webhook–shaped JSON body (full NEW row in `record`) to the CRM ingest Edge function.';

drop trigger if exists preapproval_to_crm_net on public.preapproval_leads;

create trigger preapproval_to_crm_net
  after insert on public.preapproval_leads
  for each row
  execute function public.notify_preapproval_lead_to_crm();

revoke all on function public.notify_preapproval_lead_to_crm() from public;

-- Optional: read secret from Supabase Vault instead of literals (recommended for production).
-- 1) Dashboard → Project Settings → Vault → create secrets `crm_ingest_url`, `crm_ingest_secret`
-- 2) Grant your role access per Supabase Vault docs
-- 3) Replace v_url / v_secret with:
--      (select decrypted_secret from vault.decrypted_secrets where name = 'crm_ingest_url' limit 1),
--      (select decrypted_secret from vault.decrypted_secrets where name = 'crm_ingest_secret' limit 1);
