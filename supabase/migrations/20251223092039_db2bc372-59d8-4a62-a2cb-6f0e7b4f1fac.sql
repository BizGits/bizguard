-- Strengthen events table RLS policies with explicit deny-by-default approach
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Admins can view all events" ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;

-- Create explicit PERMISSIVE policies (deny by default when no policy matches)
-- Users can ONLY view their own events
CREATE POLICY "Users can view own events"
ON public.events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all events
CREATE POLICY "Admins can view all events"
ON public.events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Users can only insert events for themselves
CREATE POLICY "Users can insert own events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Explicitly deny anonymous access by not creating any policies for anon role
-- RLS is already enabled, so anonymous users have no access by default