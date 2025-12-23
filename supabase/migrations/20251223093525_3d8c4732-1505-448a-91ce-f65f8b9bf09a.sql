-- Strengthen invitations table RLS policies to block anonymous access
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can view invitations" ON public.invitations;

-- Create explicit PERMISSIVE policies with TO authenticated (deny anonymous by default)
-- Admins can view all invitations
CREATE POLICY "Admins can view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Admins can manage all invitations (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage invitations"
ON public.invitations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role));