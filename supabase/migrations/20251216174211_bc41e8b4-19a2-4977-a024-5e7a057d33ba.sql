-- Create a function to purge old events (data retention policy - 90 days)
CREATE OR REPLACE FUNCTION public.purge_old_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Create a scheduled job to run the purge function daily using pg_cron
-- Note: This creates the extension if not exists and schedules the job
SELECT cron.schedule(
  'purge-old-events-daily',
  '0 3 * * *', -- Run at 3 AM UTC daily
  'SELECT public.purge_old_events()'
);

-- Add a comment to document the retention policy
COMMENT ON FUNCTION public.purge_old_events() IS 'Data retention policy: Automatically purges events older than 90 days to protect user privacy and comply with data minimization principles.';