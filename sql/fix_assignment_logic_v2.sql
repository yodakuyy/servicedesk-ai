-- MASTER TICKET ASSIGNMENT FIX V2
-- This version ensures Supervisor Assignment works even for 'manual' category strategy
-- if the group setting 'assign_to_supervisor_first' is enabled.

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
    -- Priority: Active supervisors first
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
      AND p.status IN ('Active', 'available', 'Available')
    ORDER BY t.last_assignment ASC NULLS FIRST, p.full_name ASC
    LIMIT 1;

    -- Fallback: Any supervisor if no active one found
    IF v_agent_id IS NULL THEN
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
        ORDER BY t.last_assignment ASC NULLS FIRST, p.full_name ASC
        LIMIT 1;
    END IF;

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
        
        -- Get Group Setting
        SELECT assign_to_supervisor_first INTO v_assign_supervisor
        FROM public.groups
        WHERE id = NEW.assignment_group_id;

        -- MANDATORY: If 'Assign to Supervisor first' is enabled, ALWAYS assign to SPV
        -- regardless of the category's assignment strategy.
        IF v_assign_supervisor = TRUE THEN
            v_agent_id := public.get_next_supervisor_for_group(NEW.assignment_group_id);
            IF v_agent_id IS NOT NULL THEN
                NEW.assigned_to := v_agent_id;
                RETURN NEW; -- Exit early, we assigned it.
            END IF;
        END IF;

        -- FALLBACK: If not assigned to SPV, check the Category's Strategy
        SELECT assignment_strategy INTO v_strategy
        FROM public.ticket_categories
        WHERE id = NEW.category_id;
        
        IF v_strategy = 'round_robin' THEN
            v_agent_id := public.get_next_agent_for_group(NEW.assignment_group_id);
            IF v_agent_id IS NOT NULL THEN
                NEW.assigned_to := v_agent_id;
            END IF;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

SELECT 'Assignment Logic (V2) successfully updated. SPV assignment now takes precedence over Category strategy.' as result;
