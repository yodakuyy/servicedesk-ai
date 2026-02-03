-- =====================================================
-- SLA PERCENTAGE ESCALATION SYSTEM
-- =====================================================
-- Process escalation rules based on SLA percentage thresholds
-- (e.g., Response 80%, Resolution 80%)
-- =====================================================

-- 1. Create function to check SLA percentage and trigger escalations
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
            g.business_hour_id,
            -- Get SLA policy from group directly
            g.sla_policy_id as group_sla_policy_id
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_to = p.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        WHERE ts.status_name NOT IN ('Resolved', 'Closed', 'Canceled')
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;
        
        -- Get business hours schedule if exists
        IF v_ticket.business_hour_id IS NOT NULL THEN
            SELECT weekly_schedule INTO v_schedule 
            FROM business_hours 
            WHERE id = v_ticket.business_hour_id 
            LIMIT 1;
        ELSE
            v_schedule := NULL;
        END IF;

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
                
                -- Calculate elapsed business minutes (simplified - using wall clock for now)
                -- For accurate calculation, should use business hours calendar
                v_elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;
                
                -- Calculate percentage used
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE
                    v_percentage_used := 0;
                END IF;

                v_log := v_log || 'Ticket ' || v_ticket.ticket_number || ': Response SLA ' || v_percentage_used || '% used. ';

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
                      -- Match policy to ticket's group SLA policy
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    -- Check if we already sent this escalation for this ticket
                    IF NOT EXISTS (
                        SELECT 1 FROM ticket_activity_log
                        WHERE ticket_id = v_ticket.id
                          AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%'
                          AND created_at > v_ticket.created_at
                    ) THEN
                        v_log := v_log || 'Triggering rule: ' || v_escalation.name || '. ';
                        
                        -- Execute escalation actions
                        -- Action: notify_supervisor
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'notify_supervisor') THEN
                            -- Get supervisor from group_supervisors table
                            SELECT user_id INTO v_supervisor_id 
                            FROM group_supervisors 
                            WHERE group_id = v_ticket.assignment_group_id
                            LIMIT 1;
                            
                            IF v_supervisor_id IS NOT NULL THEN
                                -- Send notification to supervisor
                                PERFORM send_notification(
                                    v_supervisor_id,
                                    '⚠️ SLA Response Warning!',
                                    'Tiket ' || v_ticket.ticket_number || ' sudah mencapai ' || 
                                    v_percentage_used || '% dari batas Response SLA. ' ||
                                    CASE WHEN v_ticket.agent_name IS NOT NULL 
                                         THEN 'Agent: ' || v_ticket.agent_name 
                                         ELSE 'Belum ada agent assigned' END,
                                    'escalation',
                                    'ticket',
                                    v_ticket.id::TEXT
                                );
                                v_notification_count := v_notification_count + 1;
                                v_log := v_log || 'Notified supervisor. ';
                            ELSE
                                v_log := v_log || 'No supervisor found for group. ';
                            END IF;
                        END IF;

                        -- Action: notify_group
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'notify_group') THEN
                            DECLARE
                                v_target_group_id UUID;
                                v_group_member RECORD;
                            BEGIN
                                SELECT (elem->>'target_id')::UUID INTO v_target_group_id 
                                FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                WHERE elem->>'type' = 'notify_group' 
                                LIMIT 1;
                                
                                -- Default to ticket's assignment group if no target specified
                                IF v_target_group_id IS NULL THEN
                                    v_target_group_id := v_ticket.assignment_group_id;
                                END IF;
                                
                                IF v_target_group_id IS NOT NULL THEN
                                    FOR v_group_member IN
                                        SELECT user_id FROM user_groups WHERE group_id = v_target_group_id
                                    LOOP
                                        PERFORM send_notification(
                                            v_group_member.user_id,
                                            '⚠️ SLA Warning - Group Alert',
                                            'Tiket ' || v_ticket.ticket_number || ' sudah ' || v_percentage_used || '% Response SLA.',
                                            'escalation',
                                            'ticket',
                                            v_ticket.id::TEXT
                                        );
                                        v_notification_count := v_notification_count + 1;
                                    END LOOP;
                                END IF;
                            END;
                        END IF;

                        -- Action: add_note
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'add_note') THEN
                            DECLARE
                                v_note_text TEXT;
                            BEGIN
                                SELECT elem->>'note_text' INTO v_note_text 
                                FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                WHERE elem->>'type' = 'add_note' 
                                LIMIT 1;
                                
                                INSERT INTO ticket_messages (ticket_id, sender_role, content)
                                VALUES (v_ticket.id, 'system', 
                                    COALESCE(v_note_text, 'Auto-escalation: Response SLA telah mencapai ' || v_percentage_used || '%'));
                            END;
                        END IF;

                        -- Log escalation in activity log
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
                        VALUES (
                            v_ticket.id,
                            'Escalation Rule: ' || v_escalation.name || ' triggered at ' || v_percentage_used || '% Response SLA',
                            v_ticket.assigned_to
                        );
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
                
                -- Calculate elapsed minutes
                v_elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;
                
                -- Calculate percentage used
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE
                    v_percentage_used := 0;
                END IF;

                v_log := v_log || 'Resolution SLA ' || v_percentage_used || '% used. ';

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
                          AND created_at > v_ticket.created_at
                    ) THEN
                        v_log := v_log || 'Triggering resolution rule: ' || v_escalation.name || '. ';
                        
                        -- Action: notify_supervisor
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'notify_supervisor') THEN
                            -- Get supervisor from group_supervisors table
                            SELECT user_id INTO v_supervisor_id 
                            FROM group_supervisors 
                            WHERE group_id = v_ticket.assignment_group_id
                            LIMIT 1;
                            
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(
                                    v_supervisor_id,
                                    '⚠️ SLA Resolution Warning!',
                                    'Tiket ' || v_ticket.ticket_number || ' sudah mencapai ' || 
                                    v_percentage_used || '% dari batas Resolution SLA. ' ||
                                    CASE WHEN v_ticket.agent_name IS NOT NULL 
                                         THEN 'Agent: ' || v_ticket.agent_name 
                                         ELSE 'Belum ada agent assigned' END,
                                    'escalation',
                                    'ticket',
                                    v_ticket.id::TEXT
                                );
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;

                        -- Action: add_note
                        IF v_escalation.actions IS NOT NULL AND
                           EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                   WHERE elem->>'type' = 'add_note') THEN
                            DECLARE
                                v_note_text TEXT;
                            BEGIN
                                SELECT elem->>'note_text' INTO v_note_text 
                                FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                                WHERE elem->>'type' = 'add_note' 
                                LIMIT 1;
                                
                                INSERT INTO ticket_messages (ticket_id, sender_role, content)
                                VALUES (v_ticket.id, 'system', 
                                    COALESCE(v_note_text, 'Auto-escalation: Resolution SLA telah mencapai ' || v_percentage_used || '%'));
                            END;
                        END IF;

                        -- Log escalation
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
                        VALUES (
                            v_ticket.id,
                            'Escalation Rule: ' || v_escalation.name || ' triggered at ' || v_percentage_used || '% Resolution SLA',
                            v_ticket.assigned_to
                        );
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

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION check_sla_percentage_escalations() TO authenticated;
GRANT EXECUTE ON FUNCTION check_sla_percentage_escalations() TO service_role;


-- =====================================================
-- HELPER: Add first_response_at column if not exists
-- =====================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- =====================================================
-- TRIGGER: Auto-set first_response_at when agent responds
-- =====================================================
CREATE OR REPLACE FUNCTION set_first_response_time()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an agent response (not requester or system)
    IF NEW.sender_role IN ('agent', 'Admin ITD', 'Agent L1', 'Agent L2') THEN
        -- Update first_response_at if not already set
        UPDATE tickets 
        SET first_response_at = COALESCE(first_response_at, NOW())
        WHERE id = NEW.ticket_id 
          AND first_response_at IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_set_first_response ON ticket_messages;

-- Create trigger
CREATE TRIGGER trigger_set_first_response
    AFTER INSERT ON ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION set_first_response_time();

-- =====================================================
-- SCHEDULED EXECUTION OPTIONS
-- =====================================================
-- 
-- Option 1: Using pg_cron (Supabase Pro plan)
-- Run every 5 minutes:
-- SELECT cron.schedule('check-sla-escalations', '*/5 * * * *', 'SELECT check_sla_percentage_escalations()');
--
-- Option 2: Call from frontend periodically (Dashboard, etc.)
-- await supabase.rpc('check_sla_percentage_escalations');
--
-- Option 3: Use Supabase Edge Function with cron trigger
-- =====================================================

-- =====================================================
-- TEST: Run manually to check escalations now
-- =====================================================
-- SELECT check_sla_percentage_escalations();

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'SLA Percentage Escalation System installed!' as result;

-- Show all active SLA escalation rules
SELECT 
    e.name,
    sp.name as policy_name,
    e.sla_type,
    e.trigger_type,
    e.trigger_value,
    COALESCE(e.trigger_source, 'sla') as trigger_source,
    e.is_active
FROM sla_escalations e
LEFT JOIN sla_policies sp ON e.policy_id = sp.id OR e.sla_policy_id = sp.id
WHERE e.is_active = TRUE
ORDER BY e.sla_type, e.trigger_value;
