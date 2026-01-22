-- Remove the unique constraint on project_id to allow multiple HODs per project
-- First, find and drop any unique constraints on project_id
ALTER TABLE public.project_hods DROP CONSTRAINT IF EXISTS project_hods_project_id_key;

-- Add a unique constraint on (project_id, user_id) to prevent duplicate assignments
-- (this may already exist, so we use IF NOT EXISTS pattern)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_hods_project_id_user_id_key'
  ) THEN
    ALTER TABLE public.project_hods ADD CONSTRAINT project_hods_project_id_user_id_key UNIQUE (project_id, user_id);
  END IF;
END $$;