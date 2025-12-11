-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage brands" ON public.brands;

-- Create new policy allowing both ADMIN and MANAGEMENT to manage brands
CREATE POLICY "Admins and Management can manage brands" 
ON public.brands 
FOR ALL 
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'MANAGEMENT'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'MANAGEMENT'::app_role)
);

-- Also update brand_terms policy
DROP POLICY IF EXISTS "Admins can manage terms" ON public.brand_terms;

CREATE POLICY "Admins and Management can manage terms" 
ON public.brand_terms 
FOR ALL 
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'MANAGEMENT'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'MANAGEMENT'::app_role)
);