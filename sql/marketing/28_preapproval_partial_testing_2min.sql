-- TEMPORARY testing: 2-minute partial idle + pg_cron every minute.
-- Run on **marketing** Supabase as postgres after 26_preapproval_partial_queue.sql.
--
-- Revert to production: re-run the upsert function block from 26 (30 minutes) and
-- change cron to '*/3 * * * *', or drop this migration's schedule and restore 26 defaults.
--
-- Verify queue (after filling name + email on /pre-approval, wait ~1s):
--   select marketing_lead_id, deliver_after, promoted_at, updated_at
--   from public.preapproval_partial_queue order by updated_at desc limit 5;
--
-- After 2+ minutes idle, confirm promotion:
--   select id, application_status, display_name, email, created_at
--   from public.preapproval_leads where application_status = 'partial'
--   order by created_at desc limit 5;
--
-- Manual promote (skip waiting):
--   select public.promote_due_preapproval_partials();

-- ---------------------------------------------------------------------------
-- 2-minute idle (was 30 minutes in 26)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_preapproval_partial_queue(
  p_marketing_lead_id uuid,
  p_wizard_step integer,
  p_wizard_snapshot jsonb,
  p_erased_fields jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text;
  v_last text;
  v_email text;
begin
  if p_marketing_lead_id is null then
    return json_build_object('ok', false, 'error', 'marketing_lead_id is required.', 'id', null);
  end if;

  v_first := public._preapproval_snapshot_text(p_wizard_snapshot, array['firstName', 'first_name']);
  v_last := public._preapproval_snapshot_text(p_wizard_snapshot, array['lastName', 'last_name']);
  v_email := lower(coalesce(public._preapproval_snapshot_text(p_wizard_snapshot, array['email', 'email']), ''));

  if length(trim(coalesce(v_first, ''))) < 1 then
    return json_build_object('ok', false, 'error', 'First name is required.', 'id', null);
  end if;
  if length(trim(coalesce(v_last, ''))) < 1 then
    return json_build_object('ok', false, 'error', 'Last name is required.', 'id', null);
  end if;
  if v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    return json_build_object('ok', false, 'error', 'Valid email is required.', 'id', null);
  end if;

  insert into public.preapproval_partial_queue (
    marketing_lead_id,
    deliver_after,
    wizard_step,
    wizard_snapshot,
    erased_fields,
    promoted_at,
    updated_at
  )
  values (
    p_marketing_lead_id,
    now() + interval '2 minutes',
    coalesce(p_wizard_step, 0),
    coalesce(p_wizard_snapshot, '{}'::jsonb),
    coalesce(p_erased_fields, '{}'::jsonb),
    null,
    now()
  )
  on conflict (marketing_lead_id) do update
  set
    deliver_after = now() + interval '2 minutes',
    wizard_step = excluded.wizard_step,
    wizard_snapshot = excluded.wizard_snapshot,
    erased_fields = excluded.erased_fields,
    promoted_at = null,
    updated_at = now();

  return json_build_object('ok', true, 'error', null, 'id', p_marketing_lead_id::text);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm, 'id', null);
end;
$$;

grant execute on function public.upsert_preapproval_partial_queue(uuid, integer, jsonb, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron: promote due partials every minute (enable extension in Dashboard first)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

-- Use tagged dollar quotes ($cron_setup$ / $cmd$) — nested $$ inside DO $$ causes syntax errors.
do $cron_setup$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'promote-preapproval-partials';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'promote-preapproval-partials',
    '* * * * *',
    $cmd$select public.promote_due_preapproval_partials();$cmd$
  );
end $cron_setup$;

notify pgrst, 'reload schema';
