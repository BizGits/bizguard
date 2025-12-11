-- Add last_heartbeat field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_heartbeat timestamp with time zone DEFAULT now();

-- Create function to mark inactive extensions
CREATE OR REPLACE FUNCTION public.mark_inactive_extensions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET extension_active = false
  WHERE extension_active = true
    AND (last_heartbeat IS NULL OR last_heartbeat < NOW() - INTERVAL '5 minutes');
END;
$$;