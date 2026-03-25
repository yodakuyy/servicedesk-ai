-- =================================================================
-- FIX: Team Pulse RPC - Business Hours + Holidays Aware Overdue
-- =================================================================
-- Updates get_team_pulse() to use calculate_business_minutes_sql()
-- for overdue calculation instead of wall clock.
-- This ensures holidays and business hours are respected.
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
    -- Target: Overdue Tickets using BUSINESS HOURS (not wall clock)
    -- Uses calculate_business_minutes_sql() which respects holidays + business hours
    (SELECT COUNT(*) FROM public.tickets t 
     LEFT JOIN public.groups g ON t.assignment_group_id = g.id
     LEFT JOIN public.business_hours bh ON g.business_hour_id = bh.id
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name::TEXT) NOT IN ('resolved', 'closed', 'canceled', 'rejected')
           AND LOWER(s.status_name::TEXT) NOT LIKE '%pending%'
           AND LOWER(s.status_name::TEXT) NOT LIKE '%waiting%'
     )
     AND (
        -- Calculate business elapsed minutes, subtract paused time
        GREATEST(0, 
            calculate_business_minutes_sql(t.created_at, NOW(), bh.weekly_schedule)
            - COALESCE(t.total_paused_minutes, 0)
            - CASE WHEN t.paused_at IS NOT NULL 
                   THEN calculate_business_minutes_sql(t.paused_at, NOW(), bh.weekly_schedule) 
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

SELECT 'Team Pulse RPC updated with business hours + holidays aware overdue!' as status;
