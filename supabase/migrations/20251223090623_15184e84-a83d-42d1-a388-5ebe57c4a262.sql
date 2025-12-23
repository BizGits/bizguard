-- Fix PUBLIC_DATA_EXPOSURE: Restrict profiles, invitations, and user_roles visibility

-- 1. Fix profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Admins and Management can view all profiles" ON public.profiles;

-- Users can view only their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Only ADMINS can view all profiles (not MANAGEMENT)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 2. Fix invitations table policies  
DROP POLICY IF EXISTS "Authenticated users can view invitations" ON public.invitations;

-- Only admins can view all invitations
CREATE POLICY "Admins can view invitations"
ON public.invitations
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 3. Fix user_roles table policies
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;

-- Users can view only their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::app_role));