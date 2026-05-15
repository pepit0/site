-- Optional observability for marketing → CRM webhook sync (marketing Supabase project).
-- Run after 04_submit_public_preapproval_lead.sql.

alter table public.preapproval_leads
  add column if not exists crm_sync_status text not null default 'pending'
    check (crm_sync_status in ('pending', 'synced', 'failed'));

alter table public.preapproval_leads
  add column if not exists crm_synced_at timestamptz;

alter table public.preapproval_leads
  add column if not exists crm_lead_id text;

alter table public.preapproval_leads
  add column if not exists crm_sync_error text;

create index if not exists preapproval_leads_crm_sync_status_idx
  on public.preapproval_leads (crm_sync_status, created_at desc);
