-- Add extension tracking fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS extension_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS browser text,
ADD COLUMN IF NOT EXISTS browser_version text,
ADD COLUMN IF NOT EXISTS extension_version text;

-- Add RLS policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Add RLS policy for admins to update profiles (for extension status)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'ADMIN'::app_role));