-- ==============================================================================
-- FIX TICKETS PERMISSIONS (RLS)
-- Run this in the Supabase SQL Editor to fix the "Permission denied" error for tickets.
-- ==============================================================================

-- 1. Ensure RLS is enabled (Good practice, though we will be permissive for now)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 2. Grant basic table permissions to authenticated users
GRANT ALL ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

-- 3. DROP EXISTING POLICIES to avoid conflicts
-- We drop common names to be sure we start fresh.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tickets;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.tickets;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.tickets;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public read access to tickets" ON public.tickets;

-- 4. CREATE NEW PERMISSIVE POLICIES
-- NOTE: In production, you might want to restrict SELECT/UPDATE to specific users (e.g. owner or agents).
-- For now, to unblock development, we allow authenticated users to do Insert/Select/Update.

-- Allow INSERT for any authenticated user
CREATE POLICY "Enable insert for authenticated users"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow SELECT for any authenticated user (so they can see the ticket they just created)
CREATE POLICY "Enable select for authenticated users"
ON public.tickets
FOR SELECT
TO authenticated
USING (true);

-- Allow UPDATE for any authenticated user
CREATE POLICY "Enable update for authenticated users"
ON public.tickets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. OPTIONAL: Fix permissions for sequences if needed (usually handled by Supabase, but good to be safe)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
