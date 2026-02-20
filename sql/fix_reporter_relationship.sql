-- FIX MISSING RELATIONSHIP FOR REPORTER (CREATED_BY)
-- This allows Supabase to join tickets with profiles for the 'created_by' column.

BEGIN;

-- 1. Add foreign key constraint for created_by
-- Check if it already exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_tickets_created_by' 
        AND table_name = 'tickets'
    ) THEN
        ALTER TABLE public.tickets 
        ADD CONSTRAINT fk_tickets_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES public.profiles(id);
    END IF;
END $$;

COMMIT;

SELECT 'Constraint fk_tickets_created_by added successfully.' as result;
