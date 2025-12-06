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