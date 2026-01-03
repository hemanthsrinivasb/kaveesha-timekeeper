-- Create project_hods table for Head of Department assignments
CREATE TABLE IF NOT EXISTS public.project_hods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.project_hods ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_hods
CREATE POLICY "Admins can manage project HODs" 
ON public.project_hods 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HODs can view their assignments" 
ON public.project_hods 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view project HODs" 
ON public.project_hods 
FOR SELECT 
USING (true);

-- Add hod role to app_role enum if not exists
DO $$ 
BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hod';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create function to check if user is HOD for a project
CREATE OR REPLACE FUNCTION public.is_project_hod(_user_id uuid, _project_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_hods ph
    JOIN public.projects p ON ph.project_id = p.id
    WHERE ph.user_id = _user_id
      AND p.name = _project_name
  )
$$;

-- Add RLS policy for HODs to view timesheets of their projects
CREATE POLICY "HODs can view timesheets of their projects" 
ON public.timesheets 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.project_hods ph
        JOIN public.projects p ON ph.project_id = p.id
        WHERE ph.user_id = auth.uid() AND p.name = timesheets.project
    )
);

-- Add RLS policy for HODs to update timesheets of their projects (approve/reject)
CREATE POLICY "HODs can update timesheets of their projects" 
ON public.timesheets 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.project_hods ph
        JOIN public.projects p ON ph.project_id = p.id
        WHERE ph.user_id = auth.uid() AND p.name = timesheets.project
    )
);