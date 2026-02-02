-- =====================================================
-- ESCALATION ENHANCEMENT: USER CONFIRMATION ESCALATION
-- =====================================================
-- Point D: Escalate to supervisor when user confirms
-- but agent doesn't resolve within X hours
-- =====================================================

-- 1. Add new trigger type to support user_confirmation escalation
-- This extends the existing escalation system

-- First, let's check and extend sla_escalations table if needed
ALTER TABLE sla_escalations 
ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50) DEFAULT 'sla';
-- trigger_source: 'sla' = normal SLA trigger, 'user_confirmation' = trigger based on user confirmation

COMMENT ON COLUMN sla_escalations.trigger_source IS 'Source of escalation trigger: sla (default), user_confirmation';

-- 2. Create function to check pending user confirmations and trigger escalations
CREATE OR REPLACE FUNCTION check_user_confirmation_escalations()
RETURNS void AS $$
DECLARE
    v_ticket RECORD;
    v_escalation RECORD;
    v_supervisor_id UUID;
    v_hours_since_confirmation NUMERIC;
BEGIN
    -- Find tickets where user confirmed but not yet resolved
    FOR v_ticket IN
        SELECT 
            t.id,
            t.ticket_number,
            t.subject,
            t.assigned_to,
            t.user_confirmed_at,
            t.group_id,
            p.full_name as agent_name,
            EXTRACT(EPOCH FROM (NOW() - t.user_confirmed_at)) / 3600 as hours_since_confirmation
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_to = p.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE t.user_confirmed_at IS NOT NULL
          AND t.assigned_to IS NOT NULL
          AND ts.status_name NOT IN ('Resolved', 'Closed', 'Canceled')
    LOOP
        v_hours_since_confirmation := v_ticket.hours_since_confirmation;

        -- Check escalation rules for user_confirmation
        FOR v_escalation IN
            SELECT * FROM sla_escalations
            WHERE trigger_source = 'user_confirmation'
              AND is_active = TRUE
              AND trigger_value <= v_hours_since_confirmation * 60 -- trigger_value in minutes
        LOOP
            -- Check if we already sent this escalation for this ticket
            IF NOT EXISTS (
                SELECT 1 FROM ticket_activity_log
                WHERE ticket_id = v_ticket.id
                  AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%'
                  AND created_at > v_ticket.user_confirmed_at
            ) THEN
                -- Execute escalation actions
                -- Action: notify_supervisor
                IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'notify_supervisor') THEN
                    -- Get supervisor from group
                    SELECT group_lead INTO v_supervisor_id FROM groups WHERE id = v_ticket.group_id;
                    
                    IF v_supervisor_id IS NOT NULL THEN
                        PERFORM send_notification(
                            v_supervisor_id,
                            '⚠️ Tiket Menunggu Resolution!',
                            'Tiket ' || v_ticket.ticket_number || ' dari ' || v_ticket.agent_name || ' sudah dikonfirmasi user ' || 
                            ROUND(v_hours_since_confirmation, 1) || ' jam yang lalu tapi belum di-resolve.',
                            'escalation',
                            'ticket',
                            v_ticket.id::TEXT
                        );
                    END IF;
                END IF;

                -- Action: notify_group
                IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'notify_group') THEN
                    DECLARE
                        v_target_group_id UUID;
                        v_group_member RECORD;
                    BEGIN
                        SELECT (elem->>'target_id')::UUID INTO v_target_group_id 
                        FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                        WHERE elem->>'type' = 'notify_group' 
                        LIMIT 1;
                        
                        IF v_target_group_id IS NOT NULL THEN
                            FOR v_group_member IN
                                SELECT user_id FROM user_groups WHERE group_id = v_target_group_id
                            LOOP
                                PERFORM send_notification(
                                    v_group_member.user_id,
                                    '⚠️ Tiket Pending Resolution',
                                    'Tiket ' || v_ticket.ticket_number || ' sudah dikonfirmasi user tapi belum di-resolve.',
                                    'escalation',
                                    'ticket',
                                    v_ticket.id::TEXT
                                );
                            END LOOP;
                        END IF;
                    END;
                END IF;

                -- Action: add_note
                IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_escalation.actions::jsonb) elem WHERE elem->>'type' = 'add_note') THEN
                    DECLARE
                        v_note_text TEXT;
                    BEGIN
                        SELECT elem->>'note_text' INTO v_note_text 
                        FROM jsonb_array_elements(v_escalation.actions::jsonb) elem 
                        WHERE elem->>'type' = 'add_note' 
                        LIMIT 1;
                        
                        INSERT INTO ticket_messages (ticket_id, sender_role, content)
                        VALUES (v_ticket.id, 'system', COALESCE(v_note_text, 'Auto-escalation: User confirmed but ticket not resolved.'));
                    END;
                END IF;

                -- Log escalation
                INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
                VALUES (
                    v_ticket.id,
                    'Escalation Rule: ' || v_escalation.name || ' triggered - User confirmed ' || ROUND(v_hours_since_confirmation, 1) || ' hours ago',
                    v_ticket.assigned_to
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_confirmation_escalations() TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_confirmation_escalations() TO service_role;

-- 4. First, ensure we have at least one SLA policy for user confirmation escalations
-- Create a default policy if none exists
INSERT INTO sla_policies (name, description)
SELECT 'Default Policy', 'Default SLA Policy for general escalations'
WHERE NOT EXISTS (SELECT 1 FROM sla_policies LIMIT 1);

-- 5. Create a sample escalation rule for user confirmation
-- This will notify supervisor after 2 hours of user confirmation without resolution
DO $$
DECLARE
    v_policy_id UUID;
BEGIN
    -- Get the first SLA policy ID
    SELECT id INTO v_policy_id FROM sla_policies LIMIT 1;
    
    IF v_policy_id IS NOT NULL THEN
        -- Insert 2 hour warning rule if not exists
        IF NOT EXISTS (SELECT 1 FROM sla_escalations WHERE trigger_source = 'user_confirmation' AND trigger_value = 120) THEN
            INSERT INTO sla_escalations (
                name, sla_policy_id, sla_type, trigger_percentage, action_type, trigger_type, trigger_value, trigger_source,
                actions, notification_channels, notification_message, is_active
            ) VALUES (
                'User Confirmed - 2 Hour Warning',
                v_policy_id,
                'resolution',
                100, -- trigger_percentage (required, using 100 as placeholder for user_confirmation type)
                'notify_supervisor', -- action_type (required)
                'overdue_minutes',
                120,
                'user_confirmation',
                '[{"type": "notify_supervisor"}, {"type": "add_note", "note_text": "Auto-escalation: User sudah konfirmasi selesai lebih dari 2 jam yang lalu. Segera resolve tiket ini."}]'::jsonb,
                ARRAY['in_app', 'email'],
                'User sudah konfirmasi tiket #{ticket_id} selesai sejak 2 jam lalu, tetapi tiket belum di-resolve. Prioritaskan untuk menutup tiket ini.',
                true
            );
            RAISE NOTICE 'Created 2 Hour Warning rule';
        END IF;
        
        -- Insert 4 hour critical rule if not exists
        IF NOT EXISTS (SELECT 1 FROM sla_escalations WHERE trigger_source = 'user_confirmation' AND trigger_value = 240) THEN
            INSERT INTO sla_escalations (
                name, sla_policy_id, sla_type, trigger_percentage, action_type, trigger_type, trigger_value, trigger_source,
                actions, notification_channels, notification_message, is_active
            ) VALUES (
                'User Confirmed - 4 Hour Critical',
                v_policy_id,
                'resolution',
                100, -- trigger_percentage (required)
                'notify_supervisor', -- action_type (required)
                'overdue_minutes',
                240,
                'user_confirmation',
                '[{"type": "notify_supervisor"}, {"type": "notify_group"}, {"type": "add_note", "note_text": "CRITICAL: User sudah konfirmasi selesai lebih dari 4 jam yang lalu! Tiket ini harus segera di-resolve."}]'::jsonb,
                ARRAY['in_app', 'email'],
                'CRITICAL: Tiket #{ticket_id} sudah dikonfirmasi user 4 jam lalu tapi belum di-resolve! Supervisor diminta menindaklanjuti.',
                true
            );
            RAISE NOTICE 'Created 4 Hour Critical rule';
        END IF;
    ELSE
        RAISE NOTICE 'No SLA policies found. Please create an SLA policy first.';
    END IF;
END $$;

-- =====================================================
-- SCHEDULED EXECUTION (For Supabase)
-- =====================================================
-- Option 1: Using pg_cron (Pro plan)
-- SELECT cron.schedule('check-user-confirmation-escalations', '*/30 * * * *', 'SELECT check_user_confirmation_escalations()');

-- Option 2: Call from frontend periodically (e.g., every 15 minutes in Dashboard)
-- await supabase.rpc('check_user_confirmation_escalations');

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'User Confirmation Escalation System installed!' as result;

-- Show created escalation rules
SELECT 
    name,
    trigger_source,
    trigger_value || ' minutes' as trigger_after,
    is_active
FROM sla_escalations
WHERE trigger_source = 'user_confirmation'
ORDER BY trigger_value;
