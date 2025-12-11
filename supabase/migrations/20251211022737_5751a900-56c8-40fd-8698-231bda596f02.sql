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