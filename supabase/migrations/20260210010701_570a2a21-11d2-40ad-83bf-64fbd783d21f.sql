-- Add department column to profiles table for department-wise reporting
ALTER TABLE public.profiles ADD COLUMN department text DEFAULT null;

-- Create index for faster department-based queries
CREATE INDEX idx_profiles_department ON public.profiles(department);