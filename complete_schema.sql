-- Create timesheets table
CREATE TABLE public.timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  project TEXT NOT NULL,
  hours DECIMAL(5,2) NOT NULL CHECK (hours > 0),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all timesheets" 
ON public.timesheets 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create their own timesheets" 
ON public.timesheets 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timesheets" 
ON public.timesheets 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own timesheets" 
ON public.timesheets 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_timesheets_updated_at
BEFORE UPDATE ON public.timesheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_timesheets_user_id ON public.timesheets(user_id);
CREATE INDEX idx_timesheets_date ON public.timesheets(date);
CREATE INDEX idx_timesheets_project ON public.timesheets(project);
-- Create app_role enum if not exists
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table if not exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Function to auto-create user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Update timesheets table: add end_date if not exists
DO $$ BEGIN
    ALTER TABLE public.timesheets ADD COLUMN end_date date NOT NULL DEFAULT CURRENT_DATE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Rename date to start_date if it exists
DO $$ BEGIN
    ALTER TABLE public.timesheets RENAME COLUMN date TO start_date;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Update RLS policy on timesheets to allow admins to delete any entry
DROP POLICY IF EXISTS "Users can delete their own timesheets " ON public.timesheets;
DROP POLICY IF EXISTS "Users can delete their own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users and admins can delete timesheets" ON public.timesheets;

CREATE POLICY "Users and admins can delete timesheets"
ON public.timesheets
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Users and admins can delete timesheets" ON public.timesheets;

-- Create a PERMISSIVE delete policy that allows users to delete their own timesheets OR admins to delete any
CREATE POLICY "Users can delete own timesheets"
ON public.timesheets
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any timesheet"
ON public.timesheets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
-- Fix timesheets SELECT policies - drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all timesheets" ON public.timesheets;

-- Create policy for users to view only their own timesheets
CREATE POLICY "Users can view own timesheets"
ON public.timesheets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Create policy for admins to view all timesheets
CREATE POLICY "Admins can view all timesheets"
ON public.timesheets FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin update policy for completeness
CREATE POLICY "Admins can update any timesheet"
ON public.timesheets FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
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
-- Create project_assignments table for assigning users to projects
CREATE TABLE public.project_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all assignments
CREATE POLICY "Admins can manage project assignments"
ON public.project_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
ON public.project_assignments
FOR SELECT
USING (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info',
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can create notifications for anyone
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create profiles table to store user info for dropdown selection
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can view profiles
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- Add status column to timesheets table
ALTER TABLE public.timesheets 
ADD COLUMN status text NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add reviewer columns
ALTER TABLE public.timesheets 
ADD COLUMN reviewed_by uuid,
ADD COLUMN reviewed_at timestamp with time zone,
ADD COLUMN review_notes text;

-- Create index for faster status filtering
CREATE INDEX idx_timesheets_status ON public.timesheets(status);

-- Update existing timesheets to pending status (already done by default)
