-- Implement Round Robin Logic
-- 1. Create a function to get the next agent for a group
CREATE OR REPLACE FUNCTION get_next_agent_for_group(group_id_input UUID)
RETURNS UUID AS $$
DECLARE
    next_agent_id UUID;
BEGIN
    -- This logic picks the agent in the group who was assigned a ticket the LEAST recently.
    -- This is a simple but effective Round Robin.
    
    SELECT ug.user_id INTO next_agent_id
    FROM public.user_groups ug
    LEFT JOIN (
        -- Get the last assignment time for each agent in this group
        SELECT assigned_to, MAX(created_at) as last_assigned
        FROM public.tickets
        WHERE assignment_group_id = group_id_input
        GROUP BY assigned_to
    ) t ON ug.user_id = t.assigned_to
    WHERE ug.group_id = group_id_input
    ORDER BY t.last_assigned NULLS FIRST, ug.user_id ASC
    LIMIT 1;

    RETURN next_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a trigger function to auto-assign PIC on ticket creation
CREATE OR REPLACE FUNCTION trigger_assign_ticket_round_robin()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if a group is assigned but no agent (PIC) is yet assigned
    IF NEW.assignment_group_id IS NOT NULL AND NEW.assigned_to IS NULL THEN
        NEW.assigned_to := get_next_agent_for_group(NEW.assignment_group_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to the tickets table
DROP TRIGGER IF EXISTS tr_assign_ticket_round_robin ON public.tickets;
CREATE TRIGGER tr_assign_ticket_round_robin
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION trigger_assign_ticket_round_robin();
