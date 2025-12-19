-- Add new event actions for brand management
ALTER TYPE public.event_action ADD VALUE IF NOT EXISTS 'BRAND_CREATED';
ALTER TYPE public.event_action ADD VALUE IF NOT EXISTS 'BRAND_DELETED';
ALTER TYPE public.event_action ADD VALUE IF NOT EXISTS 'BRAND_RESTORED';

-- Add soft delete column to brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update RLS policy to allow viewing deleted brands for admins (for restore functionality)
DROP POLICY IF EXISTS "Authenticated users can view active brands" ON public.brands;

CREATE POLICY "Authenticated users can view brands" 
ON public.brands 
FOR SELECT 
USING (
  (is_active = true AND deleted_at IS NULL) 
  OR has_role(auth.uid(), 'ADMIN'::app_role)
  OR has_role(auth.uid(), 'MANAGEMENT'::app_role)
);