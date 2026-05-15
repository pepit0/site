-- Allow inventory admins to permanently delete rejected submissions (cleanup).
-- Run in marketing Supabase SQL Editor as **postgres**, after 06_sell_ride_submissions.sql.
-- If the app still cannot delete rows, also run 09_admin_delete_rejected_sell_ride_submission.sql (RPC).

create policy sell_ride_submissions_admin_delete on public.sell_ride_submissions
for delete to authenticated
using (
  public.user_can_manage_inventory ()
  and status = 'rejected'
);

grant delete on public.sell_ride_submissions to authenticated;
