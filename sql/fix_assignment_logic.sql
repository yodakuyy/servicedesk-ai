-- MASTER TICKET ASSIGNMENT FIX
-- 1. Ensure groups has correct column name
-- 2. Create helper to get oldest assigned supervisor
-- 3. Update tr_func_auto_assign_pic to honor Category Strategy and Supervisor Setting

BEGIN;

-- 1. Sync Column Name (ensure assign_to_supervisor_first exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'assign_to_supervisor_first') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'assign_tasks_first') THEN
            ALTER TABLE public.groups RENAME COLUMN assign_tasks_first TO assign_to_supervisor_first;
        ELSE
            ALTER TABLE public.groups ADD COLUMN assign_to_supervisor_first BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;
END $$;

-- 2. Helper to get next supervisor for a group (Round Robin among supervisors)
CREATE OR REPLACE FUNCTION public.get_next_supervisor_for_group(p_group_id UUID)
RETURNS UUID AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    SELECT p.id INTO v_agent_id
    FROM public.profiles p
    JOIN public.group_supervisors gs ON p.id = gs.user_id
    LEFT JOIN (
        SELECT assigned_to, MAX(created_at) as last_assignment
        FROM public.tickets
        WHERE assigned_to IS NOT NULL
        GROUP BY assigned_to
    ) t ON p.id = t.assigned_to
    WHERE gs.group_id = p_group_id
      AND p.status IN ('Active', 'available', 'Available') -- Include variations
    ORDER BY t.last_assignment ASC NULLS FIRST, p.full_name ASC
    LIMIT 1;

    RETURN v_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the Master Trigger Function
CREATE OR REPLACE FUNCTION public.tr_func_auto_assign_pic()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_id UUID;
    v_strategy TEXT;
    v_assign_supervisor BOOLEAN;
BEGIN
    -- Only run if assigned_to is not manually set and group is present
    IF NEW.assigned_to IS NULL AND NEW.assignment_group_id IS NOT NULL THEN
        
        -- Get Strategy from Category
        SELECT assignment_strategy INTO v_strategy
        FROM public.ticket_categories
        WHERE id = NEW.category_id;
        
        -- Default to 'manual' if not found or empty
        IF v_strategy IS NULL OR v_strategy = '' THEN
            v_strategy := 'manual';
        END IF;

        -- ONLY Auto-Assign if strategy is 'round_robin'
        IF v_strategy = 'round_robin' THEN
            -- Get Group Setting
            SELECT assign_to_supervisor_first INTO v_assign_supervisor
            FROM public.groups
            WHERE id = NEW.assignment_group_id;

            IF v_assign_supervisor = TRUE THEN
                -- Try to get supervisor first
                v_agent_id := public.get_next_supervisor_for_group(NEW.assignment_group_id);
                IF v_agent_id IS NOT NULL THEN
                    NEW.assigned_to := v_agent_id;
                    RETURN NEW;
                END IF;
            END IF;
            
            -- Fallback to standard Round Robin among all agents in group
            v_agent_id := public.get_next_agent_for_group(NEW.assignment_group_id);
            IF v_agent_id IS NOT NULL THEN
                NEW.assigned_to := v_agent_id;
            END IF;
        END IF;
        
        -- If strategy is 'manual', assigned_to remains NULL (Manual / Queue behavior)
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

SELECT 'Assignment Logic successfully updated to honor Round Robin vs Manual strategy and Supervisor First setting.' as result;
