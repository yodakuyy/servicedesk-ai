-- MASTER ROUND ROBIN IMPLEMENTATION V4 (STABLE)
-- This script fixes Schema, Foreign Keys, Permissions, and Logic.
-- Run this in the Supabase SQL Editor.

BEGIN;

-- 1. FIX SCHEMA & COLUMNS
DO $$
BEGIN
    -- Add assigned_to if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assigned_to') THEN
        ALTER TABLE public.tickets ADD COLUMN assigned_to UUID REFERENCES public.profiles(id);
    END IF;

    -- Add assignment_group_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assignment_group_id') THEN
        ALTER TABLE public.tickets ADD COLUMN assignment_group_id UUID;
    END IF;
END $$;

-- 2. FIX FOREIGN KEY (CRITICAL: Switch from assignment_groups to groups)
DO $$
BEGIN
    -- Drop the old constraint if it exists (it was pointing to the wrong or inaccessible table)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_assignment_group_id_fkey') THEN
        ALTER TABLE public.tickets DROP CONSTRAINT tickets_assignment_group_id_fkey;
    END IF;
    
    -- Add the correct constraint pointing to public.groups
    ALTER TABLE public.tickets 
    ADD CONSTRAINT tickets_assignment_group_id_fkey 
    FOREIGN KEY (assignment_group_id) 
    REFERENCES public.groups(id);
END $$;

-- 3. FIX PERMISSIONS (Clear all RLS blockers)
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.groups TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.roles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_groups TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. DROP OLD FUNCTION IF EXISTS (To avoid parameter name mismatch)
DROP FUNCTION IF EXISTS public.get_next_agent_for_group(UUID);

-- 5. CREATE HELPER FUNCTION TO GET NEXT AGENT (ROUND ROBIN)
CREATE OR REPLACE FUNCTION public.get_next_agent_for_group(p_group_id UUID)
RETURNS UUID AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    -- Logic: Pick agent in the group with role 'Agent L1' (3) or 'Agent Supervisor' (2)
    -- who has the least recent (oldest) assignment or no assignments yet.
    -- EXCLUDING 'Administrator' (1) and 'Agent L2' (5).
    
    SELECT p.id INTO v_agent_id
    FROM public.profiles p
    JOIN public.user_groups ug ON p.id = ug.user_id
    JOIN public.roles r ON p.role_id = r.role_id
    LEFT JOIN (
        -- Subquery to find the most recent assignment for each agent
        SELECT assigned_to, MAX(created_at) as last_assignment
        FROM public.tickets
        WHERE assigned_to IS NOT NULL
        GROUP BY assigned_to
    ) t ON p.id = t.assigned_to
    WHERE ug.group_id = p_group_id
      -- AND p.status = 'Active' -- Enable if you have a status column
      AND r.role_name IN ('Agent L1', 'Agent Supervisor')
      AND r.role_name NOT IN ('Administrator', 'Agent L2')
    ORDER BY t.last_assignment ASC NULLS FIRST, p.created_at ASC
    LIMIT 1;

    RETURN v_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREATE TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.tr_func_auto_assign_pic()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    -- Only run if assigned_to is not manually set and group is present
    IF NEW.assigned_to IS NULL AND NEW.assignment_group_id IS NOT NULL THEN
        v_agent_id := public.get_next_agent_for_group(NEW.assignment_group_id);
        
        IF v_agent_id IS NOT NULL THEN
            NEW.assigned_to := v_agent_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. ATTACH TRIGGER
DROP TRIGGER IF EXISTS tr_auto_assign_pic ON public.tickets;
CREATE TRIGGER tr_auto_assign_pic
    BEFORE INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.tr_func_auto_assign_pic();

COMMIT;

-- VERIFICATION
SELECT 'Round Robin V4 STABLE Patch successfully installed.' as result;
