
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  is_admin boolean;
  excluded_projects text[] := ARRAY['LEAVE', 'HOLIDAY'];
BEGIN
  is_admin := has_role(auth.uid(), 'admin'::app_role);
  
  IF is_admin THEN
    SELECT json_build_object(
      'total_hours', COALESCE(SUM(CASE WHEN status = 'approved' AND NOT (UPPER(project) = ANY(excluded_projects)) THEN hours ELSE 0 END), 0),
      'total_projects', COUNT(DISTINCT project),
      'this_week_hours', COALESCE(SUM(CASE WHEN start_date >= CURRENT_DATE - INTERVAL '7 days' AND status IN ('approved', 'pending') AND NOT (UPPER(project) = ANY(excluded_projects)) THEN hours ELSE 0 END), 0),
      'total_entries', COUNT(*)
    ) INTO result
    FROM public.timesheets;
  ELSE
    SELECT json_build_object(
      'total_hours', COALESCE(SUM(CASE WHEN status = 'approved' AND NOT (UPPER(project) = ANY(excluded_projects)) THEN hours ELSE 0 END), 0),
      'total_projects', COUNT(DISTINCT project),
      'this_week_hours', COALESCE(SUM(CASE WHEN start_date >= CURRENT_DATE - INTERVAL '7 days' AND status IN ('approved', 'pending') AND NOT (UPPER(project) = ANY(excluded_projects)) THEN hours ELSE 0 END), 0),
      'total_entries', COUNT(*)
    ) INTO result
    FROM public.timesheets
    WHERE user_id = auth.uid();
  END IF;

  RETURN result;
END;
$function$;
