-- =====================================================
-- FIX SLA BUSINESS HOURS CALCULATION
-- =====================================================
-- Corrects the escalation logic to use business hours 
-- instead of wall clock, preventing premature warnings.
-- =====================================================

-- 1. Helper function to calculate business minutes
CREATE OR REPLACE FUNCTION calculate_business_minutes_sql(
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
    IF p_schedule IS NULL OR jsonb_array_length(p_schedule) = 0 THEN
        RETURN EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
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

-- 2. Update the escalation function to use business hours
CREATE OR REPLACE FUNCTION check_sla_percentage_escalations()
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_escalation RECORD;
    v_supervisor_id UUID;
    v_target RECORD;
    v_sla_target_minutes INTEGER;
    v_elapsed_minutes NUMERIC;
    v_percentage_used NUMERIC;
    v_schedule JSONB;
    v_processed_count INTEGER := 0;
    v_notification_count INTEGER := 0;
    v_log TEXT := '';
BEGIN
    -- Find all active tickets that may need escalation
    FOR v_ticket IN
        SELECT 
            t.id,
            t.ticket_number,
            t.subject,
            t.priority,
            t.assigned_to,
            t.assignment_group_id,
            t.created_at,
            t.updated_at,
            t.first_response_at,
            p.full_name as agent_name,
            ts.status_name,
            g.name as group_name,
            -- Get business hours and SLA policy from group
            g.business_hour_id,
            g.sla_policy_id as group_sla_policy_id,
            bh.weekly_schedule
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_to = p.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        LEFT JOIN business_hours bh ON g.business_hour_id = bh.id
        WHERE ts.status_name NOT IN ('Resolved', 'Closed', 'Canceled')
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;
        
        v_schedule := v_ticket.weekly_schedule;

        -- Check Response SLA (only if no first response yet)
        IF v_ticket.first_response_at IS NULL AND v_ticket.group_sla_policy_id IS NOT NULL THEN
            -- Get response SLA target
            SELECT * INTO v_target
            FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id
              AND sla_type = 'response'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT)
            LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 60);
                
                -- USE BUSINESS HOURS CALCULATION
                v_elapsed_minutes := calculate_business_minutes_sql(v_ticket.created_at, NOW(), v_schedule);
                
                -- Calculate percentage used
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE
                    v_percentage_used := 0;
                END IF;

                -- Check escalation rules for this percentage
                FOR v_escalation IN
                    SELECT e.*, sp.name as policy_name
                    FROM sla_escalations e
                    LEFT JOIN sla_policies sp ON e.policy_id = sp.id OR e.sla_policy_id = sp.id
                    WHERE e.is_active = TRUE
                      AND (e.trigger_source IS NULL OR e.trigger_source = 'sla')
                      AND e.trigger_type = 'percentage'
                      AND e.sla_type = 'response'
                      AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    -- Check if we already sent this escalation for this ticket
                    IF NOT EXISTS (
                        SELECT 1 FROM ticket_activity_log
                        WHERE ticket_id = v_ticket.id
                          AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%'
                          AND created_at > (NOW() - interval '24 hours') -- Avoid re-sending same day if threshold is reached
                    ) THEN
                        -- Execute escalation actions (notify_supervisor)
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'notify_supervisor') THEN
                            
                            SELECT user_id INTO v_supervisor_id 
                            FROM group_supervisors 
                            WHERE group_id = v_ticket.assignment_group_id
                            LIMIT 1;
                            
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(
                                    v_supervisor_id,
                                    '⚠️ SLA Response Warning!',
                                    'Tiket ' || v_ticket.ticket_number || ' sudah mencapai ' || 
                                    v_percentage_used || '% dari batas Response SLA. Agent: ' || COALESCE(v_ticket.agent_name, 'Unassigned'),
                                    'escalation',
                                    'ticket',
                                    v_ticket.id::TEXT
                                );
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;

                        -- Log activity
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
                        VALUES (v_ticket.id, 'Escalation Rule: ' || v_escalation.name || ' triggered at ' || v_percentage_used || '% Response SLA', v_ticket.assigned_to);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- Check Resolution SLA (for all active tickets)
        IF v_ticket.group_sla_policy_id IS NOT NULL THEN
            -- Get resolution SLA target
            SELECT * INTO v_target
            FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id
              AND sla_type = 'resolution'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT)
            LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 240);
                
                -- USE BUSINESS HOURS CALCULATION
                v_elapsed_minutes := calculate_business_minutes_sql(v_ticket.created_at, NOW(), v_schedule);
                
                -- Calculate percentage used
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE
                    v_percentage_used := 0;
                END IF;

                -- Check escalation rules for resolution percentage
                FOR v_escalation IN
                    SELECT e.*, sp.name as policy_name
                    FROM sla_escalations e
                    LEFT JOIN sla_policies sp ON e.policy_id = sp.id OR e.sla_policy_id = sp.id
                    WHERE e.is_active = TRUE
                      AND (e.trigger_source IS NULL OR e.trigger_source = 'sla')
                      AND e.trigger_type = 'percentage'
                      AND e.sla_type = 'resolution'
                      AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    -- Check if we already sent this escalation for this ticket
                    IF NOT EXISTS (
                        SELECT 1 FROM ticket_activity_log
                        WHERE ticket_id = v_ticket.id
                          AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%'
                          AND created_at > (NOW() - interval '24 hours')
                    ) THEN
                        -- Action: notify_supervisor
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'notify_supervisor') THEN
                            
                            SELECT user_id INTO v_supervisor_id 
                            FROM group_supervisors 
                            WHERE group_id = v_ticket.assignment_group_id
                            LIMIT 1;
                            
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(
                                    v_supervisor_id,
                                    '⚠️ SLA Resolution Warning!',
                                    'Tiket ' || v_ticket.ticket_number || ' sudah mencapai ' || 
                                    v_percentage_used || '% dari batas Resolution SLA. Agent: ' || COALESCE(v_ticket.agent_name, 'Unassigned'),
                                    'escalation',
                                    'ticket',
                                    v_ticket.id::TEXT
                                );
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;

                        -- Log activity
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
                        VALUES (v_ticket.id, 'Escalation Rule: ' || v_escalation.name || ' triggered at ' || v_percentage_used || '% Resolution SLA', v_ticket.assigned_to);
                    END IF;
                END LOOP;
            END IF;
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'processed_tickets', v_processed_count,
        'notifications_sent', v_notification_count,
        'executed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
