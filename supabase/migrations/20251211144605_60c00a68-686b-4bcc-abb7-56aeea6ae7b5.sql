-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins and Management can view all profiles (needed for dashboard)
CREATE POLICY "Admins and Management can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'MANAGEMENT'::app_role)
);