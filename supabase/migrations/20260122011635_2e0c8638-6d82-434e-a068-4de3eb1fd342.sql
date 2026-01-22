-- Create project_admins table for assigning multiple admins to projects
CREATE TABLE public.project_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_admins ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage project admins"
ON public.project_admins
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view project admins"
ON public.project_admins
FOR SELECT
USING (true);

-- Add index for performance
CREATE INDEX idx_project_admins_project_id ON public.project_admins(project_id);
CREATE INDEX idx_project_admins_user_id ON public.project_admins(user_id);