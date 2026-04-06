-- FIX ROUND ROBIN OOO STATUS CHECK (V2)
-- This script ensures tickets are not assigned to agents who are "Out Of Office" or "OOO".
-- Run this in the Supabase SQL Editor.

BEGIN;

-- Update the helper function to check for profile status
CREATE OR REPLACE FUNCTION public.get_next_agent_for_group(p_group_id UUID)
RETURNS UUID AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    -- Logic: Pick agent in the group with role 'Agent L1' (3) or 'Agent Supervisor' (2)
    -- who has the least recent (oldest) assignment or no assignments yet.
    
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
      -- CRITICAL FIX: EXCLUDE OUT OF OFFICE AGENTS
      AND (
          p.status IS NULL 
          OR (
              LOWER(p.status) NOT LIKE '%out of office%' 
              AND LOWER(p.status) NOT LIKE '%ooo%'
              AND LOWER(p.status) NOT LIKE '%busy%'
          )
      )
      -- Ensure they have the correct roles
      AND r.role_name IN ('Agent L1', 'Agent Supervisor')
      AND r.role_name NOT IN ('Administrator', 'Agent L2')
    ORDER BY t.last_assignment ASC NULLS FIRST, p.created_at ASC
    LIMIT 1;

    RETURN v_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

SELECT 'Round Robin OOO Fix V2 applied successfully.' as result;
