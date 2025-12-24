-- Strengthen brand_terms table RLS policies
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view terms" ON public.brand_terms;
DROP POLICY IF EXISTS "Admins and Management can manage terms" ON public.brand_terms;

-- Create explicit PERMISSIVE policies with TO authenticated

-- All authenticated users can view terms (read-only)
CREATE POLICY "Authenticated users can view terms"
ON public.brand_terms
FOR SELECT
TO authenticated
USING (true);

-- Only Admins and Management can insert terms
CREATE POLICY "Admins and Management can insert terms"
ON public.brand_terms
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'MANAGEMENT'::app_role));

-- Only Admins and Management can update terms
CREATE POLICY "Admins and Management can update terms"
ON public.brand_terms
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'MANAGEMENT'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'MANAGEMENT'::app_role));

-- Only Admins and Management can delete terms
CREATE POLICY "Admins and Management can delete terms"
ON public.brand_terms
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'MANAGEMENT'::app_role));