-- =================================================================
-- FIX: "column r.id does not exist"
-- =================================================================
-- This script fixes the error where queries/views (like group_members view)
-- try to access 'id' column on the 'roles' table, but only 'role_id' exists.
--
-- We will add 'id' as a generated column that mirrors 'role_id'.
-- This is safe and ensures compatibility with both 'r.id' and 'r.role_id'.
-- =================================================================

BEGIN;

DO $$
BEGIN
    -- 1. Check if 'roles' table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
        
        -- 2. Check if 'id' column is MISSING
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'id') THEN
            
            -- 3. Add 'id' as a stored generated column mirroring 'role_id'
            -- Note: We assume role_id is compatible (likely Integer).
            -- If role_id is serial/int, this works perfectly.
            
            RAISE NOTICE 'Adding id column to roles table...';
            ALTER TABLE public.roles 
            ADD COLUMN id INT GENERATED ALWAYS AS (role_id) STORED;
            
        ELSE
            RAISE NOTICE 'id column already exists on roles table.';
        END IF;

    ELSE
        RAISE NOTICE 'roles table does not exist.';
    END IF;
END $$;

COMMIT;

-- Verification
SELECT role_id, id, role_name FROM public.roles LIMIT 5;
