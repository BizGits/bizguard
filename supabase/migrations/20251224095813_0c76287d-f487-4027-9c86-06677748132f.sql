-- Add UPDATE and DELETE policies for events table
-- Only admins can update or delete events (for audit integrity)

-- Admins can update events if needed
CREATE POLICY "Admins can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role));

-- Admins can delete events if needed
CREATE POLICY "Admins can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));