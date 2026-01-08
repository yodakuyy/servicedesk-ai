-- Run this in Supabase SQL Editor to fix the "Permission Denied" error
-- 1. Grant permissions to all roles
GRANT ALL ON TABLE public.ticket_categories TO authenticated;
GRANT ALL ON TABLE public.ticket_categories TO anon;
GRANT ALL ON TABLE public.ticket_categories TO service_role;

-- 2. Disable RLS for testing (or you can add specific policies later)
ALTER TABLE public.ticket_categories DISABLE ROW LEVEL SECURITY;
