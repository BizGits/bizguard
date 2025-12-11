-- Create invitations table for dashboard access control
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can manage invitations"
ON public.invitations
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'))
WITH CHECK (has_role(auth.uid(), 'ADMIN'));

-- Authenticated users can view invitations (for checking their own)
CREATE POLICY "Authenticated users can view invitations"
ON public.invitations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add the admin user's email as pre-invited
INSERT INTO public.invitations (email) VALUES ('it@bizcuits.io');