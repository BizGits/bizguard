-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Set replica identity to full for better realtime updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;