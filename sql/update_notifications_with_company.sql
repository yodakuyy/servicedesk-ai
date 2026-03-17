-- Add company_id to notifications for multi-department support
BEGIN;

-- 1. Add company_id column to notifications table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.notifications 
        ADD COLUMN company_id INTEGER REFERENCES public.company(company_id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added company_id column to notifications table.';
    END IF;
END $$;

-- 2. Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);

-- 3. Update send_notification function to accept company_id
CREATE OR REPLACE FUNCTION send_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'info',
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_company_id INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, company_id)
    VALUES (p_user_id, p_title, p_message, p_type, p_reference_type, p_reference_id, p_company_id)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update notify_on_new_ticket trigger function
CREATE OR REPLACE FUNCTION notify_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_id UUID;
    v_ticket_number TEXT;
    v_company_id INTEGER;
BEGIN
    v_agent_id := NEW.assigned_to;
    v_ticket_number := NEW.ticket_number;
    
    -- Get company_id from ticket_categories since tickets table might not have it
    SELECT company_id INTO v_company_id 
    FROM ticket_categories 
    WHERE id = NEW.category_id;
    
    IF v_agent_id IS NOT NULL THEN
        PERFORM send_notification(
            v_agent_id,
            'Tiket Baru Ditugaskan',
            'Tiket ' || v_ticket_number || ' telah ditugaskan kepada Anda.',
            'ticket_assigned',
            'ticket',
            NEW.id::TEXT,
            v_company_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update notify_on_ticket_reply trigger function
CREATE OR REPLACE FUNCTION notify_on_ticket_reply()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket RECORD;
    v_sender_name TEXT;
    v_company_id INTEGER;
BEGIN
    -- Get ticket info and company_id from categories
    SELECT t.*, p.full_name as requester_name, tc.company_id as category_company_id
    INTO v_ticket
    FROM tickets t
    LEFT JOIN profiles p ON t.requester_id = p.id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    WHERE t.id = NEW.ticket_id;
    
    v_company_id := v_ticket.category_company_id;

    -- Get sender name
    SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
    
    -- If message is from requester (not agent), notify the assigned agent
    IF NEW.sender_id = v_ticket.requester_id AND v_ticket.assigned_to IS NOT NULL THEN
        PERFORM send_notification(
            v_ticket.assigned_to,
            'Balasan Baru dari User',
            v_sender_name || ' membalas tiket ' || v_ticket.ticket_number,
            'ticket_reply',
            'ticket',
            v_ticket.id::TEXT,
            v_company_id
        );
    END IF;
    
    -- If message is from agent, notify the requester
    IF NEW.sender_id != v_ticket.requester_id AND v_ticket.requester_id IS NOT NULL THEN
        PERFORM send_notification(
            v_ticket.requester_id,
            'Agent Membalas Tiket Anda',
            'Ada balasan baru untuk tiket ' || v_ticket.ticket_number,
            'ticket_reply',
            'ticket',
            v_ticket.id::TEXT,
            v_company_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update check_sla_percentage_escalations function with joining ticket_categories
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
    FOR v_ticket IN
        SELECT 
            t.id, t.ticket_number, t.subject, t.priority, t.assigned_to, t.assignment_group_id,
            t.created_at, t.updated_at, t.first_response_at, tc.company_id, -- Join with categories
            p.full_name as agent_name, ts.status_name,
            g.name as group_name, g.business_hour_id, g.sla_policy_id as group_sla_policy_id
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_to = p.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id -- Joining categories
        WHERE ts.status_name NOT IN ('Resolved', 'Closed', 'Canceled')
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;
        
        -- Response SLA Check
        IF v_ticket.first_response_at IS NULL AND v_ticket.group_sla_policy_id IS NOT NULL THEN
            SELECT * INTO v_target FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id AND sla_type = 'response'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT) LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 60);
                v_elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;
                v_percentage_used := CASE WHEN v_sla_target_minutes > 0 THEN ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2) ELSE 0 END;

                FOR v_escalation IN
                    SELECT e.* FROM sla_escalations e
                    WHERE e.is_active = TRUE AND (e.trigger_source IS NULL OR e.trigger_source = 'sla')
                      AND e.trigger_type = 'percentage' AND e.sla_type = 'response' AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    IF NOT EXISTS (SELECT 1 FROM ticket_activity_log WHERE ticket_id = v_ticket.id AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%') THEN
                        -- Notify Supervisor
                        IF v_escalation.actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'notify_supervisor') THEN
                            SELECT user_id INTO v_supervisor_id FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(v_supervisor_id, '⚠️ SLA Response Warning!', 'Tiket ' || v_ticket.ticket_number || ' mencapai ' || v_percentage_used || '% SLA.', 'escalation', 'ticket', v_ticket.id::TEXT, v_ticket.company_id);
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- Resolution SLA Check
        IF v_ticket.group_sla_policy_id IS NOT NULL THEN
            SELECT * INTO v_target FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id AND sla_type = 'resolution'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT) LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 240);
                v_elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;
                v_percentage_used := CASE WHEN v_sla_target_minutes > 0 THEN ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2) ELSE 0 END;

                FOR v_escalation IN
                    SELECT e.* FROM sla_escalations e
                    WHERE e.is_active = TRUE AND (e.trigger_source IS NULL OR e.trigger_source = 'sla')
                      AND e.trigger_type = 'percentage' AND e.sla_type = 'resolution' AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    IF NOT EXISTS (SELECT 1 FROM ticket_activity_log WHERE ticket_id = v_ticket.id AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%') THEN
                        IF v_escalation.actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'notify_supervisor') THEN
                            SELECT user_id INTO v_supervisor_id FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                            IF v_supervisor_id IS NOT NULL THEN
                                PERFORM send_notification(v_supervisor_id, '⚠️ SLA Resolution Warning!', 'Tiket ' || v_ticket.ticket_number || ' mencapai ' || v_percentage_used || '% SLA.', 'escalation', 'ticket', v_ticket.id::TEXT, v_ticket.company_id);
                                v_notification_count := v_notification_count + 1;
                            END IF;
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'processed_tickets', v_processed_count, 'notifications_sent', v_notification_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Backfill company_id for existing ticket notifications (joining categories)
UPDATE notifications n
SET company_id = tc.company_id
FROM tickets t
JOIN ticket_categories tc ON t.category_id = tc.id
WHERE n.reference_type = 'ticket' 
AND n.reference_id = t.id::TEXT
AND n.company_id IS NULL;

COMMIT;
