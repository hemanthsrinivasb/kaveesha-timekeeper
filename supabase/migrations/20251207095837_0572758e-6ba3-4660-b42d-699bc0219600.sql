-- Create projects table for data integrity
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Everyone can view active projects
CREATE POLICY "Anyone can view active projects"
ON public.projects FOR SELECT TO authenticated
USING (is_active = true);

-- Only admins can manage projects
CREATE POLICY "Admins can manage projects"
ON public.projects FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default projects
INSERT INTO public.projects (name, description) VALUES 
  ('Project Alpha', 'Main development project'),
  ('Project Beta', 'Secondary development project'),
  ('Internal Operations', 'Internal company operations'),
  ('Client Support', 'Customer support activities'),
  ('Research & Development', 'R&D initiatives');

-- Create RPC function for analytics stats (server-side aggregation)
CREATE OR REPLACE FUNCTION public.get_analytics_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_hours', COALESCE(SUM(hours), 0),
    'total_employees', COUNT(DISTINCT employee_id),
    'total_projects', COUNT(DISTINCT project),
    'avg_hours_per_entry', COALESCE(AVG(hours), 0),
    'total_entries', COUNT(*)
  ) INTO result
  FROM public.timesheets;

  RETURN result;
END;
$$;

-- Create RPC function for project distribution
CREATE OR REPLACE FUNCTION public.get_project_distribution()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(
    json_build_object('name', project, 'value', ROUND(total_hours::numeric, 1))
  ) INTO result
  FROM (
    SELECT project, SUM(hours) as total_hours
    FROM public.timesheets
    GROUP BY project
    ORDER BY total_hours DESC
  ) subq;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Create RPC function for employee productivity
CREATE OR REPLACE FUNCTION public.get_employee_productivity()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins
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
    GROUP BY employee_id, name
    ORDER BY total_hours DESC
    LIMIT 10
  ) subq;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Create RPC function for weekly trend
CREATE OR REPLACE FUNCTION public.get_weekly_trend()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins
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
    GROUP BY w.week_offset
    ORDER BY w.week_offset DESC
  )
  SELECT json_agg(
    json_build_object('week', week_label, 'hours', ROUND(hours::numeric, 1))
  ) INTO result
  FROM week_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;