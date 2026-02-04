
-- Create RPC function for dashboard stats that works for both admin and regular users
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  is_admin boolean;
BEGIN
  -- Check if user is admin
  is_admin := has_role(auth.uid(), 'admin'::app_role);
  
  IF is_admin THEN
    -- Admin sees all data
    SELECT json_build_object(
      'total_hours', COALESCE(SUM(hours), 0),
      'total_projects', COUNT(DISTINCT project),
      'this_week_hours', COALESCE(SUM(CASE WHEN start_date >= CURRENT_DATE - INTERVAL '7 days' THEN hours ELSE 0 END), 0),
      'total_entries', COUNT(*)
    ) INTO result
    FROM public.timesheets;
  ELSE
    -- Regular user sees only their data
    SELECT json_build_object(
      'total_hours', COALESCE(SUM(hours), 0),
      'total_projects', COUNT(DISTINCT project),
      'this_week_hours', COALESCE(SUM(CASE WHEN start_date >= CURRENT_DATE - INTERVAL '7 days' THEN hours ELSE 0 END), 0),
      'total_entries', COUNT(*)
    ) INTO result
    FROM public.timesheets
    WHERE user_id = auth.uid();
  END IF;

  RETURN result;
END;
$$;
