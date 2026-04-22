-- =================================================================
-- FIX: Team Pulse RPC - Accuracy and Visibility Fix
-- =================================================================
-- 1. Uses calculate_business_minutes_sql for accurate overdue counts
-- 2. Restores agent_status column
-- 3. Improves visibility for Super Admins
-- =================================================================

-- 1. Ensure the business hours helper exists or recreate it
CREATE OR REPLACE FUNCTION public.calculate_business_minutes_sql(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_schedule JSONB
) RETURNS NUMERIC AS $$
DECLARE
    v_total_minutes NUMERIC := 0;
    v_current_time TIMESTAMPTZ;
    v_day_name TEXT;
    v_day_config JSONB;
    v_start_hour INT;
    v_start_min INT;
    v_end_hour INT;
    v_end_min INT;
    v_work_start TIMESTAMPTZ;
    v_work_end TIMESTAMPTZ;
    v_segment_start TIMESTAMPTZ;
    v_segment_end TIMESTAMPTZ;
BEGIN
    -- If no schedule, use wall clock
    IF p_start_time IS NULL OR p_end_time IS NULL OR p_schedule IS NULL OR jsonb_array_length(p_schedule) = 0 THEN
        IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
            RETURN EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
        END IF;
        RETURN 0;
    END IF;

    -- Ensure end is after start
    IF p_end_time <= p_start_time THEN
        RETURN 0;
    END IF;

    v_current_time := p_start_time;

    -- Iterate day by day
    WHILE v_current_time < p_end_time LOOP
        v_day_name := trim(to_char(v_current_time, 'Day'));
        
        -- Find config for this day in the JSON array
        v_day_config := NULL;
        SELECT elem INTO v_day_config
        FROM jsonb_array_elements(p_schedule) elem
        WHERE trim(elem->>'day') = v_day_name;

        -- If day is active, calculate overlap with work hours
        IF v_day_config IS NOT NULL AND (v_day_config->>'isActive')::BOOLEAN = TRUE THEN
            v_start_hour := split_part(COALESCE(v_day_config->>'startTime', '08:00'), ':', 1)::INT;
            v_start_min := split_part(COALESCE(v_day_config->>'startTime', '08:00'), ':', 2)::INT;
            v_end_hour := split_part(COALESCE(v_day_config->>'endTime', '17:00'), ':', 1)::INT;
            v_end_min := split_part(COALESCE(v_day_config->>'endTime', '17:00'), ':', 2)::INT;

            -- Work hours for the CURRENT day in the loop
            v_work_start := (date_trunc('day', v_current_time AT TIME ZONE 'Asia/Jakarta') + (v_start_hour || ' hours ' || v_start_min || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta';
            v_work_end := (date_trunc('day', v_current_time AT TIME ZONE 'Asia/Jakarta') + (v_end_hour || ' hours ' || v_end_min || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta';

            -- The segment of work hours that falls within the start/end range
            v_segment_start := GREATEST(v_current_time, v_work_start);
            v_segment_end := LEAST(p_end_time, v_work_end);

            IF v_segment_start < v_segment_end THEN
                v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_segment_end - v_segment_start)) / 60);
            END IF;
        END IF;

        -- Move to start of next day (00:00:00)
        v_current_time := date_trunc('day', (v_current_time AT TIME ZONE 'Asia/Jakarta') + interval '1 day') AT TIME ZONE 'Asia/Jakarta';
    END LOOP;

    RETURN v_total_minutes;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Recreate get_team_pulse
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
    (SELECT COUNT(*) FROM public.tickets t 
     LEFT JOIN public.groups g ON t.assignment_group_id = g.id
     LEFT JOIN public.business_hours bh ON g.business_hour_id = bh.id
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.sla_behavior = 'run'
           AND s.is_final = false
     )
     AND (
        -- Calculate business elapsed minutes minus paused time
        GREATEST(0,
            public.calculate_business_minutes_sql(t.created_at, NOW(), bh.weekly_schedule)
            - COALESCE(t.total_paused_minutes, 0)
            - CASE WHEN t.paused_at IS NOT NULL 
                   THEN public.calculate_business_minutes_sql(t.paused_at, NOW(), bh.weekly_schedule)
                   ELSE 0 END
        ) > (
            -- SLA limit in minutes based on priority (Matches Dashboard.tsx)
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
  WHERE p.role_id IN (1, 2, 3) -- Include Admin, SPV, and Agent
  AND (
    v_viewer_role = 1 -- Admin sees all
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_viewer_id AND role_id = 1) -- Double check for Admin
    OR p.id IN (
      SELECT ug2.user_id FROM public.user_groups ug2
      JOIN public.user_groups ug1 ON ug1.group_id = ug2.group_id
      WHERE ug1.user_id = v_viewer_id
    )
    -- Also show agents from the same department if no groups found
    OR p.company_id = (SELECT prof.company_id FROM public.profiles prof WHERE prof.id = v_viewer_id)
  )
  ORDER BY 
    CASE WHEN p.role_id = 1 THEN 0 WHEN p.role_id = 2 THEN 1 ELSE 2 END ASC,
    active_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO service_role;

SELECT 'Team Pulse RPC updated with BUSINESS HOURS accuracy!' as status;
