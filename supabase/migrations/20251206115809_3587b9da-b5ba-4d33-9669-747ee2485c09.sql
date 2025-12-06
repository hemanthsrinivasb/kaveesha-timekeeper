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