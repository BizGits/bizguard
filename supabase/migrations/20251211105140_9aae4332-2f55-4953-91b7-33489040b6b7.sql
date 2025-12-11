-- Allow all authenticated users to view profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view user roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);