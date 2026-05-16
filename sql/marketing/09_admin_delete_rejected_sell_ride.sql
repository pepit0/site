-- Permanent delete for rejected sell-ride submissions (marketing Supabase).
-- Run after 06_sell_ride_submissions.sql. Required for Admin → Rejected → Delete permanently.

-- RLS: admins may DELETE only rejected rows (client fallback when RPC missing).
drop policy if exists sell_ride_submissions_admin_delete on public.sell_ride_submissions;

create policy sell_ride_submissions_admin_delete on public.sell_ride_submissions
  for delete to authenticated
  using (
    public.user_can_manage_inventory ()
    and status = 'rejected'
  );

grant delete on table public.sell_ride_submissions to authenticated;

create or replace function public.admin_delete_rejected_sell_ride_submission(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if p_id is null then
    return json_build_object('ok', false, 'error', 'Missing submission id.');
  end if;

  if not public.user_can_manage_inventory() then
    return json_build_object('ok', false, 'error', 'Not authorized.');
  end if;

  delete from public.sell_ride_submissions
  where id = p_id
    and status = 'rejected';

  get diagnostics v_deleted = row_count;

  if v_deleted < 1 then
    return json_build_object(
      'ok',
      false,
      'error',
      'Rejected submission not found or already deleted.'
    );
  end if;

  return json_build_object('ok', true, 'error', null);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.admin_delete_rejected_sell_ride_submission(uuid) from public, anon;
grant execute on function public.admin_delete_rejected_sell_ride_submission(uuid) to authenticated;

notify pgrst, 'reload schema';
