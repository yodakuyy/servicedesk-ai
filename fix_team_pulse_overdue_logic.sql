-- =================================================================
-- FIX: Team Pulse RPC Overdue Logic (V2 - Robust)
-- =================================================================
-- This script updates the 'get_team_pulse' function to use dynamic
-- SLA thresholds, case-insensitive priorities, and excludes 
-- Pending/Waiting statuses from overdue calculation.
-- =================================================================

CREATE OR REPLACE FUNCTION public.get_team_pulse()
RETURNS TABLE (
  agent_id uuid,
  full_name text,
  email text,
  role_id int,
  active_count bigint,
  resolved_today_count bigint,
  overdue_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_viewer_id uuid;
    v_viewer_role int;
BEGIN
  v_viewer_id := auth.uid();
  
  -- Get viewer's role
  SELECT p.role_id INTO v_viewer_role FROM public.profiles p WHERE p.id = v_viewer_id;

  RETURN QUERY
  SELECT 
    p.id as agent_id,
    p.full_name::TEXT,
    p.email::TEXT,
    p.role_id::INT,
    -- Target: Active Tickets (Open, In Progress, Pending)
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name::TEXT) IN ('open', 'in progress') 
            OR LOWER(s.status_name::TEXT) LIKE '%pending%'
            OR LOWER(s.status_name::TEXT) LIKE '%waiting%'
            OR LOWER(s.status_name::TEXT) = 'escalated'
     ))::bigint as active_count,
    -- Target: Resolved Today
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name::TEXT) IN ('resolved', 'closed')
     )
     AND t.updated_at::date = CURRENT_DATE)::bigint as resolved_today_count,
    -- Target: Overdue Tickets (Exclude Pending/Waiting)
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name::TEXT) NOT IN ('resolved', 'closed', 'canceled', 'rejected')
           AND LOWER(s.status_name::TEXT) NOT LIKE '%pending%'
           AND LOWER(s.status_name::TEXT) NOT LIKE '%waiting%'
     )
     AND (
        -- Dynamic SLA based on priority (Case-Insensitive)
        (LOWER(t.priority::TEXT) IN ('urgent', 'critical') AND t.created_at < (NOW() - INTERVAL '4 hours')) OR
        (LOWER(t.priority::TEXT) = 'high' AND t.created_at < (NOW() - INTERVAL '8 hours')) OR
        (LOWER(t.priority::TEXT) = 'medium' AND t.created_at < (NOW() - INTERVAL '48 hours')) OR
        (LOWER(t.priority::TEXT) = 'low' AND t.created_at < (NOW() - INTERVAL '120 hours')) OR
        -- Fallback default 24h
        (LOWER(COALESCE(t.priority::TEXT, '')) NOT IN ('urgent', 'critical', 'high', 'medium', 'low') AND t.created_at < (NOW() - INTERVAL '24 hours'))
     )
    )::bigint as overdue_count
  FROM public.profiles p
  WHERE p.role_id IN (2, 3) -- Only SPV and Agent
  AND (
    v_viewer_role = 1 -- Admin sees all
    OR NOT EXISTS (SELECT 1 FROM public.user_groups WHERE user_id = v_viewer_id) -- If viewer has no group
    OR p.id IN (
      -- Show team members
      SELECT ug2.user_id FROM public.user_groups ug2
      JOIN public.user_groups ug1 ON ug1.group_id = ug2.group_id
      WHERE ug1.user_id = v_viewer_id
    )
  )
  ORDER BY 
    CASE WHEN p.role_id = 2 THEN 0 ELSE 1 END ASC, -- SPV first
    active_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO service_role;
