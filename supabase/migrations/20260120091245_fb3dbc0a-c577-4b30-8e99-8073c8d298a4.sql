-- Drop the unused update_last_seen function to reduce attack surface
DROP FUNCTION IF EXISTS public.update_last_seen(uuid);