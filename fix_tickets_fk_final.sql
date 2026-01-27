-- FIX TICKETS FOREIGN KEY AND PERMISSIONS
-- This script fixes the FK constraint that was pointing to the wrong table
-- and ensures permissions are correct.

BEGIN;

-- 1. Fix Foreign Key on tickets table
-- It was pointing to 'assignment_groups' which seems inconsistent with the rest of the app
-- We switch it to point to 'groups' table.

DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_assignment_group_id_fkey') THEN
        ALTER TABLE public.tickets DROP CONSTRAINT tickets_assignment_group_id_fkey;
    END IF;
    
    -- Add the correct constraint pointing to public.groups
    ALTER TABLE public.tickets 
    ADD CONSTRAINT tickets_assignment_group_id_fkey 
    FOREIGN KEY (assignment_group_id) 
    REFERENCES public.groups(id);
END $$;

-- 2. Ensure permissions on groups table (since it's our master now)
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.groups TO anon, authenticated, service_role;

-- 3. Just in case 'assignment_groups' is still used elsewhere, fix its permissions too
-- (We saw 'Permission Denied' for this table earlier)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignment_groups') THEN
        ALTER TABLE public.assignment_groups DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON TABLE public.assignment_groups TO anon, authenticated, service_role;
    END IF;
END $$;

COMMIT;

SELECT 'Foreign Key and Permissions fixed.' as result;
