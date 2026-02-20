-- Fix Ticket Schema for Round Robin Assignment
-- Run this in the Supabase SQL Editor

BEGIN;

-- 1. Add 'assigned_to' column to 'tickets' table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assigned_to') THEN
        ALTER TABLE public.tickets ADD COLUMN assigned_to UUID REFERENCES public.profiles(id);
        RAISE NOTICE 'Added assigned_to column to tickets table.';
    END IF;
END $$;

-- 2. Add 'assignment_group_id' column if it's missing (should already be there, but just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assignment_group_id') THEN
        ALTER TABLE public.tickets ADD COLUMN assignment_group_id UUID REFERENCES public.groups(id);
        RAISE NOTICE 'Added assignment_group_id column to tickets table.';
    END IF;
END $$;

-- 3. Ensure everyone can see/update the assignment (for Round Robin)
-- If RLS is enabled, we need to allow the trigger (signed as SECURITY DEFINER) to update it.
-- But the function is already SECURITY DEFINER, so it should be fine.

-- 4. Grant access to profiles for joins
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

COMMIT;
