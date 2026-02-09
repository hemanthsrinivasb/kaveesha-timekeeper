
-- Fix get_analytics_stats to only count approved work hours (exclude LEAVE, HOLIDAY, REJECTED)
CREATE OR REPLACE FUNCTION public.get_analytics_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  excluded_projects text[] := ARRAY['LEAVE', 'HOLIDAY'];
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_hours', COALESCE(SUM(CASE WHEN status = 'approved' AND NOT (UPPER(project) = ANY(excluded_projects)) THEN hours ELSE 0 END), 0),
    'total_employees', COUNT(DISTINCT employee_id),
    'total_projects', COUNT(DISTINCT project),
    'avg_hours_per_entry', COALESCE(AVG(CASE WHEN status = 'approved' AND NOT (UPPER(project) = ANY(excluded_projects)) THEN hours END), 0),
    'total_entries', COUNT(*)
  ) INTO result
  FROM public.timesheets;

  RETURN result;
END;
$function$;

-- Fix get_employee_productivity to only count approved work hours
CREATE OR REPLACE FUNCTION public.get_employee_productivity()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  excluded_projects text[] := ARRAY['LEAVE', 'HOLIDAY'];
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(
    json_build_object(
      'name', name,
      'hours', ROUND(total_hours::numeric, 1),
      'entries', entry_count
    )
  ) INTO result
  FROM (
    SELECT name, SUM(hours) as total_hours, COUNT(*) as entry_count
    FROM public.timesheets
    WHERE status = 'approved'
      AND NOT (UPPER(project) = ANY(excluded_projects))
    GROUP BY employee_id, name
    ORDER BY total_hours DESC
    LIMIT 10
  ) subq;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Fix get_project_distribution to only count approved hours
CREATE OR REPLACE FUNCTION public.get_project_distribution()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(
    json_build_object('name', project, 'value', ROUND(total_hours::numeric, 1))
  ) INTO result
  FROM (
    SELECT project, SUM(hours) as total_hours
    FROM public.timesheets
    WHERE status = 'approved'
    GROUP BY project
    ORDER BY total_hours DESC
  ) subq;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Fix get_weekly_trend to only count approved work hours
CREATE OR REPLACE FUNCTION public.get_weekly_trend()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  excluded_projects text[] := ARRAY['LEAVE', 'HOLIDAY'];
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH weeks AS (
    SELECT generate_series(0, 7) as week_offset
  ),
  week_data AS (
    SELECT 
      w.week_offset,
      CONCAT('Week ', 8 - w.week_offset) as week_label,
      COALESCE(SUM(t.hours), 0) as hours
    FROM weeks w
    LEFT JOIN public.timesheets t ON 
      t.start_date >= (CURRENT_DATE - ((w.week_offset + 1) * 7))::date
      AND t.start_date < (CURRENT_DATE - (w.week_offset * 7))::date
      AND t.status = 'approved'
      AND NOT (UPPER(t.project) = ANY(excluded_projects))
    GROUP BY w.week_offset
    ORDER BY w.week_offset DESC
  )
  SELECT json_agg(
    json_build_object('week', week_label, 'hours', ROUND(hours::numeric, 1))
  ) INTO result
  FROM week_data;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
