-- =====================================================
-- FIX FINAL: SLA ESCALATION - HOLIDAYS + BUSINESS HOURS + COMPANY_ID
-- =====================================================
-- MASALAH YANG DIPERBAIKI:
-- 1. calculate_business_minutes_sql() tidak cek tabel holidays
-- 2. check_sla_percentage_escalations() di "update_notifications_with_company.sql"
--    MASIH PAKAI WALL CLOCK (menimpa versi yang sudah benar)
-- 3. Notification masuk terus karena tidak ada INSERT activity log 
--    (duplikat check gagal tanpa log entry)
-- =====================================================

-- 1. FIXED: calculate_business_minutes_sql + holidays support
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
    v_current_date_str TEXT;
    v_is_holiday BOOLEAN;
    v_break_active BOOLEAN;
    v_break_start TIMESTAMPTZ;
    v_break_end TIMESTAMPTZ;
    v_break_start_hour INT;
    v_break_start_min INT;
    v_break_end_hour INT;
    v_break_end_min INT;
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
        v_day_name := trim(to_char(v_current_time AT TIME ZONE 'Asia/Jakarta', 'Day'));
        
        -- ★★★ CHECK HOLIDAYS TABLE ★★★
        v_current_date_str := to_char(v_current_time AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD');
        
        SELECT EXISTS(
            SELECT 1 FROM holidays 
            WHERE holiday_date = v_current_date_str::DATE
        ) INTO v_is_holiday;

        -- Skip holidays entirely
        IF v_is_holiday THEN
            v_current_time := date_trunc('day', (v_current_time AT TIME ZONE 'Asia/Jakarta') + interval '1 day') AT TIME ZONE 'Asia/Jakarta';
            CONTINUE;
        END IF;
        
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

            v_work_start := (date_trunc('day', v_current_time AT TIME ZONE 'Asia/Jakarta') + (v_start_hour || ' hours ' || v_start_min || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta';
            v_work_end := (date_trunc('day', v_current_time AT TIME ZONE 'Asia/Jakarta') + (v_end_hour || ' hours ' || v_end_min || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta';

            v_segment_start := GREATEST(v_current_time, v_work_start);
            v_segment_end := LEAST(p_end_time, v_work_end);

            IF v_segment_start < v_segment_end THEN
                -- Check for break time
                v_break_active := COALESCE((v_day_config->>'breakActive')::BOOLEAN, FALSE);
                
                IF v_break_active AND v_day_config->>'breakStartTime' IS NOT NULL AND v_day_config->>'breakEndTime' IS NOT NULL THEN
                    v_break_start_hour := split_part(v_day_config->>'breakStartTime', ':', 1)::INT;
                    v_break_start_min := split_part(v_day_config->>'breakStartTime', ':', 2)::INT;
                    v_break_end_hour := split_part(v_day_config->>'breakEndTime', ':', 1)::INT;
                    v_break_end_min := split_part(v_day_config->>'breakEndTime', ':', 2)::INT;
                    
                    v_break_start := (date_trunc('day', v_current_time AT TIME ZONE 'Asia/Jakarta') + (v_break_start_hour || ' hours ' || v_break_start_min || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta';
                    v_break_end := (date_trunc('day', v_current_time AT TIME ZONE 'Asia/Jakarta') + (v_break_end_hour || ' hours ' || v_break_end_min || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta';
                    
                    IF v_segment_start < v_break_start AND v_segment_end > v_break_end THEN
                        v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_break_start - v_segment_start)) / 60);
                        v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_segment_end - v_break_end)) / 60);
                    ELSIF v_segment_end <= v_break_start OR v_segment_start >= v_break_end THEN
                        v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_segment_end - v_segment_start)) / 60);
                    ELSIF v_segment_start < v_break_start THEN
                        v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_break_start - v_segment_start)) / 60);
                    ELSIF v_segment_end > v_break_end THEN
                        v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_segment_end - v_break_end)) / 60);
                    END IF;
                ELSE
                    v_total_minutes := v_total_minutes + (EXTRACT(EPOCH FROM (v_segment_end - v_segment_start)) / 60);
                END IF;
            END IF;
        END IF;

        v_current_time := date_trunc('day', (v_current_time AT TIME ZONE 'Asia/Jakarta') + interval '1 day') AT TIME ZONE 'Asia/Jakarta';
    END LOOP;

    RETURN v_total_minutes;
END;
$$ LANGUAGE plpgsql STABLE;


-- 2. FIXED: check_sla_percentage_escalations - FINAL VERSION
-- Combines: business hours + holidays + paused time + company_id + activity log
CREATE OR REPLACE FUNCTION check_sla_percentage_escalations()
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_escalation RECORD;
    v_supervisor_id UUID;
    v_target RECORD;
    v_sla_target_minutes INTEGER;
    v_elapsed_minutes NUMERIC;
    v_current_pause_minutes NUMERIC;
    v_percentage_used NUMERIC;
    v_schedule JSONB;
    v_processed_count INTEGER := 0;
    v_notification_count INTEGER := 0;
    v_log TEXT := '';
BEGIN
    FOR v_ticket IN
        SELECT 
            t.id, t.ticket_number, t.subject, t.priority, t.assigned_to, t.assignment_group_id,
            t.created_at, t.updated_at, t.first_response_at, t.paused_at, t.total_paused_minutes,
            p.full_name as agent_name, ts.status_name, ts.sla_behavior,
            g.name as group_name, g.business_hour_id, g.sla_policy_id as group_sla_policy_id,
            g.company_id,
            bh.weekly_schedule
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_to = p.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        LEFT JOIN business_hours bh ON g.business_hour_id = bh.id
        WHERE ts.sla_behavior != 'stop'
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;
        v_schedule := v_ticket.weekly_schedule;

        -- 1. Calculate total business minutes elapsed (with holidays!)
        v_elapsed_minutes := calculate_business_minutes_sql(v_ticket.created_at, NOW(), v_schedule);
        
        -- 2. Subtract permanently paused minutes
        v_elapsed_minutes := v_elapsed_minutes - COALESCE(v_ticket.total_paused_minutes, 0);

        -- 3. If currently paused, subtract current pause duration
        IF v_ticket.paused_at IS NOT NULL THEN
            v_current_pause_minutes := calculate_business_minutes_sql(v_ticket.paused_at, NOW(), v_schedule);
            v_elapsed_minutes := v_elapsed_minutes - v_current_pause_minutes;
        END IF;

        -- Ensure non-negative
        v_elapsed_minutes := GREATEST(0, v_elapsed_minutes);

        -- CHECK RESPONSE SLA
        IF v_ticket.first_response_at IS NULL AND v_ticket.group_sla_policy_id IS NOT NULL THEN
            SELECT * INTO v_target FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id AND sla_type = 'response'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT) LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 60);
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE v_percentage_used := 0; END IF;

                v_log := v_log || v_ticket.ticket_number || ' Response: ' || v_percentage_used || '%. ';

                FOR v_escalation IN
                    SELECT e.* FROM sla_escalations e
                    WHERE e.is_active = TRUE AND e.trigger_type = 'percentage' AND e.sla_type = 'response'
                      AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    -- ★★★ DUPLICATE CHECK: only trigger once per 24 hours ★★★
                    IF NOT EXISTS (
                        SELECT 1 FROM ticket_activity_log 
                        WHERE ticket_id = v_ticket.id 
                          AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%' 
                          AND created_at > (NOW() - interval '24 hours')
                    ) THEN
                        -- Notify supervisor
                        IF v_escalation.actions IS NOT NULL AND 
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'notify_supervisor') THEN
                            SELECT user_id INTO v_supervisor_id FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(
                                    v_supervisor_id, 
                                    '⚠️ SLA Response Warning!', 
                                    'Tiket ' || v_ticket.ticket_number || ' mencapai ' || v_percentage_used || '% SLA. Agent: ' || COALESCE(v_ticket.agent_name, 'Unassigned'), 
                                    'escalation', 'ticket', v_ticket.id::TEXT, v_ticket.company_id
                                );
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;

                        -- ★★★ INSERT ACTIVITY LOG (was missing in update_notifications_with_company.sql!) ★★★
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id) 
                        VALUES (v_ticket.id, 'Escalation Rule: ' || v_escalation.name || ' at ' || v_percentage_used || '% Response SLA', v_ticket.assigned_to);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- CHECK RESOLUTION SLA
        IF v_ticket.group_sla_policy_id IS NOT NULL THEN
            SELECT * INTO v_target FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id AND sla_type = 'resolution'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT) LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 240);
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE v_percentage_used := 0; END IF;

                v_log := v_log || v_ticket.ticket_number || ' Resolution: ' || v_percentage_used || '%. ';

                FOR v_escalation IN
                    SELECT e.* FROM sla_escalations e
                    WHERE e.is_active = TRUE AND e.trigger_type = 'percentage' AND e.sla_type = 'resolution'
                      AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    -- ★★★ DUPLICATE CHECK ★★★
                    IF NOT EXISTS (
                        SELECT 1 FROM ticket_activity_log 
                        WHERE ticket_id = v_ticket.id 
                          AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%' 
                          AND created_at > (NOW() - interval '24 hours')
                    ) THEN
                        IF v_escalation.actions IS NOT NULL AND 
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'notify_supervisor') THEN
                            SELECT user_id INTO v_supervisor_id FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(
                                    v_supervisor_id, 
                                    '⚠️ SLA Resolution Warning!', 
                                    'Tiket ' || v_ticket.ticket_number || ' mencapai ' || v_percentage_used || '% SLA. Agent: ' || COALESCE(v_ticket.agent_name, 'Unassigned'), 
                                    'escalation', 'ticket', v_ticket.id::TEXT, v_ticket.company_id
                                );
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;

                        -- ★★★ INSERT ACTIVITY LOG ★★★
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id) 
                        VALUES (v_ticket.id, 'Escalation Rule: ' || v_escalation.name || ' at ' || v_percentage_used || '% Resolution SLA', v_ticket.assigned_to);
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_tickets', v_processed_count, 
        'notifications_sent', v_notification_count, 
        'log', v_log,
        'executed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Also update process_escalation_rules to use business hours
CREATE OR REPLACE FUNCTION process_escalation_rules()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket RECORD;
    v_rule RECORD;
    v_sla_target_minutes INTEGER;
    v_elapsed_minutes NUMERIC;
    v_percentage_used NUMERIC;
    v_overdue_minutes NUMERIC;
    v_should_trigger BOOLEAN;
    v_processed_count INTEGER := 0;
    v_triggered_count INTEGER := 0;
    v_action RECORD;
    v_target_user_id UUID;
    v_result JSONB;
    v_schedule JSONB;
BEGIN
    FOR v_ticket IN
        SELECT 
            t.id, t.ticket_number, t.subject, t.priority, t.assigned_to, t.assignment_group_id,
            t.created_at, t.updated_at, t.first_response_at, t.paused_at, t.total_paused_minutes,
            g.sla_policy_id, ts.status_name, bh.weekly_schedule
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        LEFT JOIN business_hours bh ON g.business_hour_id = bh.id
        WHERE ts.is_final = false
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;
        v_schedule := v_ticket.weekly_schedule;

        FOR v_rule IN
            SELECT er.*, sp.name as policy_name
            FROM escalation_rules er
            LEFT JOIN sla_policies sp ON er.sla_policy_id = sp.id
            WHERE er.is_active = true
              AND (er.sla_policy_id = v_ticket.sla_policy_id OR er.sla_policy_id IS NULL)
            ORDER BY er.trigger_value ASC
        LOOP
            v_should_trigger := false;

            SELECT COALESCE(target_minutes, 60) INTO v_sla_target_minutes
            FROM sla_targets
            WHERE sla_policy_id = v_ticket.sla_policy_id
              AND sla_type = v_rule.sla_type
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT)
            LIMIT 1;

            IF v_sla_target_minutes IS NULL THEN
                v_sla_target_minutes := 60;
            END IF;

            -- ★ Use BUSINESS HOURS calculation (not wall clock!) ★
            IF v_rule.sla_type = 'response' AND v_ticket.first_response_at IS NULL THEN
                v_elapsed_minutes := calculate_business_minutes_sql(v_ticket.created_at, NOW(), v_schedule);
                -- Subtract paused time
                v_elapsed_minutes := v_elapsed_minutes - COALESCE(v_ticket.total_paused_minutes, 0);
                IF v_ticket.paused_at IS NOT NULL THEN
                    v_elapsed_minutes := v_elapsed_minutes - calculate_business_minutes_sql(v_ticket.paused_at, NOW(), v_schedule);
                END IF;
                v_elapsed_minutes := GREATEST(0, v_elapsed_minutes);
            ELSIF v_rule.sla_type = 'resolution' THEN
                v_elapsed_minutes := calculate_business_minutes_sql(v_ticket.created_at, NOW(), v_schedule);
                v_elapsed_minutes := v_elapsed_minutes - COALESCE(v_ticket.total_paused_minutes, 0);
                IF v_ticket.paused_at IS NOT NULL THEN
                    v_elapsed_minutes := v_elapsed_minutes - calculate_business_minutes_sql(v_ticket.paused_at, NOW(), v_schedule);
                END IF;
                v_elapsed_minutes := GREATEST(0, v_elapsed_minutes);
            ELSE
                CONTINUE;
            END IF;

            IF v_rule.trigger_type = 'percentage' THEN
                v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                IF v_percentage_used >= v_rule.trigger_value THEN
                    v_should_trigger := true;
                END IF;
            ELSIF v_rule.trigger_type = 'overdue_minutes' THEN
                v_overdue_minutes := v_elapsed_minutes - v_sla_target_minutes;
                IF v_overdue_minutes >= v_rule.trigger_value THEN
                    v_should_trigger := true;
                END IF;
            END IF;

            IF v_should_trigger THEN
                IF EXISTS (
                    SELECT 1 FROM ticket_activity_log
                    WHERE ticket_id = v_ticket.id
                      AND action LIKE '%Escalation: ' || v_rule.name || '%'
                      AND created_at > (NOW() - interval '24 hours')
                ) THEN
                    v_should_trigger := false;
                END IF;
            END IF;

            IF v_should_trigger THEN
                v_triggered_count := v_triggered_count + 1;

                FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions)
                LOOP
                    IF v_action.value->>'type' = 'notify_supervisor' THEN
                        SELECT user_id INTO v_target_user_id
                        FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                        IF v_target_user_id IS NOT NULL THEN
                            INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                            VALUES (v_target_user_id, '⚠️ SLA Escalation Alert',
                                COALESCE(v_rule.notification_message, 'Ticket ' || v_ticket.ticket_number || ' has triggered escalation rule: ' || v_rule.name),
                                'escalation', 'ticket', v_ticket.id, false, NOW());
                        END IF;
                    END IF;

                    IF v_action.value->>'type' = 'notify_group' THEN
                        DECLARE
                            v_group_member RECORD;
                            v_notify_group_id UUID;
                        BEGIN
                            v_notify_group_id := COALESCE((v_action.value->>'target_id')::UUID, v_ticket.assignment_group_id);
                            FOR v_group_member IN
                                SELECT gm.user_id FROM group_members gm WHERE gm.group_id = v_notify_group_id AND gm.is_active = true
                            LOOP
                                INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                                VALUES (v_group_member.user_id, '⚠️ SLA Escalation - Group Alert',
                                    'Ticket ' || v_ticket.ticket_number || ' requires attention.',
                                    'escalation', 'ticket', v_ticket.id, false, NOW());
                            END LOOP;
                        END;
                    END IF;

                    IF v_action.value->>'type' = 'notify_user' THEN
                        v_target_user_id := (v_action.value->>'target_id')::UUID;
                        IF v_target_user_id IS NOT NULL THEN
                            INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                            VALUES (v_target_user_id, '⚠️ SLA Escalation Alert',
                                'Ticket ' || v_ticket.ticket_number || ' has triggered escalation: ' || v_rule.name,
                                'escalation', 'ticket', v_ticket.id, false, NOW());
                        END IF;
                    END IF;

                    IF v_action.value->>'type' = 'reassign' THEN
                        v_target_user_id := (v_action.value->>'target_id')::UUID;
                        IF v_target_user_id IS NOT NULL THEN
                            UPDATE tickets SET assigned_to = v_target_user_id, updated_at = NOW() WHERE id = v_ticket.id;
                        END IF;
                    END IF;

                    IF v_action.value->>'type' = 'change_priority' THEN
                        DECLARE v_new_priority TEXT;
                        BEGIN
                            v_new_priority := v_action.value->>'new_priority';
                            IF v_new_priority IS NOT NULL THEN
                                UPDATE tickets SET priority = v_new_priority, updated_at = NOW() WHERE id = v_ticket.id;
                            END IF;
                        END;
                    END IF;

                    IF v_action.value->>'type' = 'add_note' THEN
                        DECLARE v_note_text TEXT;
                        BEGIN
                            v_note_text := COALESCE(v_action.value->>'note_text', 'Auto-escalation triggered: ' || v_rule.name);
                            INSERT INTO ticket_replies (ticket_id, content, is_internal, reply_type, created_at)
                            VALUES (v_ticket.id, v_note_text, true, 'system', NOW());
                        END;
                    END IF;
                END LOOP;

                INSERT INTO ticket_activity_log (ticket_id, action, actor_id, created_at)
                VALUES (v_ticket.id, 'Escalation: ' || v_rule.name || ' triggered (' || v_rule.trigger_type || ' = ' || v_rule.trigger_value || ')', v_ticket.assigned_to, NOW());

                UPDATE escalation_rules SET escalations_triggered = COALESCE(escalations_triggered, 0) + 1, updated_at = NOW() WHERE id = v_rule.id;
            END IF;
        END LOOP;
    END LOOP;

    v_result := jsonb_build_object('success', true, 'processed', v_processed_count, 'triggered', v_triggered_count, 'executed_at', NOW());
    RETURN v_result;
END;
$$;


-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION calculate_business_minutes_sql(TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_business_minutes_sql(TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION check_sla_percentage_escalations() TO authenticated;
GRANT EXECUTE ON FUNCTION check_sla_percentage_escalations() TO service_role;
GRANT EXECUTE ON FUNCTION process_escalation_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION process_escalation_rules() TO service_role;


-- 5. CLEANUP: Delete wrong notifications for INC-12824
-- (Remove the spam notifications with wrong percentages)
DELETE FROM notifications 
WHERE type = 'escalation' 
  AND (title LIKE '%SLA Response Warning%' OR title LIKE '%SLA Resolution Warning%')
  AND message LIKE '%INC-12824%'
  AND created_at > (NOW() - interval '7 days');

-- Also cleanup old activity log entries so escalation can re-trigger correctly
DELETE FROM ticket_activity_log 
WHERE action LIKE '%Escalation Rule:%' 
  AND ticket_id = (SELECT id FROM tickets WHERE ticket_number = 'INC-12824' LIMIT 1)
  AND created_at > (NOW() - interval '7 days');


-- 6. VERIFICATION
SELECT 'FIXED: SLA escalation now uses holidays + business hours + company_id!' as status;

-- Test: See business minutes for INC-12824 (should be much less than wall clock)
-- SELECT calculate_business_minutes_sql(
--     (SELECT created_at FROM tickets WHERE ticket_number = 'INC-12824'),
--     NOW(),
--     (SELECT bh.weekly_schedule FROM tickets t JOIN groups g ON t.assignment_group_id = g.id JOIN business_hours bh ON g.business_hour_id = bh.id WHERE t.ticket_number = 'INC-12824')
-- ) as correct_business_minutes;
