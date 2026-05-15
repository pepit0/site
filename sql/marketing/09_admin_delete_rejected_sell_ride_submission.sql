-- Reliable delete for rejected sell-your-ride rows (bypasses client DELETE / RLS quirks).
-- Run as **postgres** after 06_sell_ride_submissions.sql. Optional if 08 + direct delete already works.

create or replace function public.admin_delete_rejected_sell_ride_submission (p_id uuid) returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_can_manage_inventory () then
    return json_build_object('ok', false, 'error', 'Not allowed.');
  end if;

  delete from public.sell_ride_submissions
  where id = p_id
    and status = 'rejected';

  if not found then
    return json_build_object('ok', false, 'error', 'Not found or not in rejected status.');
  end if;

  return json_build_object('ok', true, 'error', null);
end;
$$;

revoke all on function public.admin_delete_rejected_sell_ride_submission (uuid) from public;

grant execute on function public.admin_delete_rejected_sell_ride_submission (uuid) to authenticated;
