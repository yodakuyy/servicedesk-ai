-- =================================================================
-- FIX: Team Pulse RPC - Dynamic Status Detection
-- =================================================================
-- Updates get_team_pulse() to use is_final and sla_behavior columns
-- instead of hardcoded status names. This ensures consistency with
-- the dashboard stats and properly handles 'APPROVED', 'REJECTED', etc.
--
-- FIXES:
--   1. Column name: assignment_group_id (not assigned_group_id)
--   2. Restored agent_status column
--   3. Simplified overdue calc to avoid dependency on
--      calculate_business_minutes_sql which may not be deployed
-- =================================================================

DROP FUNCTION IF EXISTS public.get_team_pulse();

CREATE OR REPLACE FUNCTION public.get_team_pulse()
RETURNS TABLE (
  agent_id uuid,
  full_name text,
  email text,
  role_id int,
  active_count bigint,
  resolved_today_count bigint,
  overdue_count bigint,
  agent_status text
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

    -- Active Tickets: SLA is running or paused, AND not final
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.is_final = false 
           AND s.sla_behavior <> 'stop'
     ))::bigint as active_count,

    -- Resolved Today: Tickets moved to a final/stop status today
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.is_final = true OR s.sla_behavior = 'stop'
     )
     AND t.updated_at::date = CURRENT_DATE)::bigint as resolved_today_count,

    -- Overdue Tickets: SLA is 'run', not final, and elapsed > priority limit
    -- Uses simple wall-clock time minus paused minutes as a safe fallback
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.sla_behavior = 'run'
           AND s.is_final = false
     )
     AND (
        -- Wall-clock elapsed minutes minus paused time
        GREATEST(0,
            EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 60
            - COALESCE(t.total_paused_minutes, 0)
            - CASE WHEN t.paused_at IS NOT NULL 
                   THEN EXTRACT(EPOCH FROM (NOW() - t.paused_at)) / 60
                   ELSE 0 END
        ) > (
            -- SLA limit in minutes based on priority
            CASE 
                WHEN LOWER(t.priority::TEXT) IN ('urgent', 'critical') THEN 240   -- 4 hours
                WHEN LOWER(t.priority::TEXT) = 'high' THEN 480                     -- 8 hours
                WHEN LOWER(t.priority::TEXT) = 'medium' THEN 2880                  -- 48 hours
                WHEN LOWER(t.priority::TEXT) = 'low' THEN 7200                     -- 120 hours
                ELSE 1440                                                           -- 24 hours default
            END
        )
     )
    )::bigint as overdue_count,

    p.status::TEXT as agent_status

  FROM public.profiles p
  WHERE p.role_id IN (2, 3) -- Only SPV and Agent
  AND (
    v_viewer_role = 1 -- Admin sees all
    OR NOT EXISTS (SELECT 1 FROM public.user_groups WHERE user_id = v_viewer_id)
    OR p.id IN (
      SELECT ug2.user_id FROM public.user_groups ug2
      JOIN public.user_groups ug1 ON ug1.group_id = ug2.group_id
      WHERE ug1.user_id = v_viewer_id
    )
  )
  ORDER BY 
    CASE WHEN p.role_id = 2 THEN 0 ELSE 1 END ASC,
    active_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO service_role;

SELECT 'Team Pulse RPC updated with dynamic status detection!' as status;
