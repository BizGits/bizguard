-- Strengthen events table RLS policies to block anonymous access
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Admins can view all events" ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;

-- Create explicit PERMISSIVE policies with TO authenticated (deny anonymous by default)
-- Users can view their own events
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

-- Users can insert their own events
CREATE POLICY "Users can insert own events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);