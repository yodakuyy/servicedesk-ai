-- =====================================================
-- ENHANCED ESCALATION RULES - Support for UI Component
-- =====================================================
-- This extends the existing SLA escalation system to support
-- the EscalationRules.tsx component format and additional features.
-- =====================================================

-- =====================================================
-- 1. Create escalation_rules table if not exists (for UI)
-- =====================================================
CREATE TABLE IF NOT EXISTS escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    sla_type VARCHAR(50) DEFAULT 'response', -- response, resolution
    trigger_type VARCHAR(50) DEFAULT 'percentage', -- percentage, overdue_minutes
    trigger_value INTEGER NOT NULL, -- percentage or minutes
    trigger_source VARCHAR(50) DEFAULT 'sla', -- sla, user_confirmation
    actions JSONB DEFAULT '[]'::jsonb,
    notification_channels TEXT[] DEFAULT ARRAY['in_app'],
    notification_message TEXT,
    is_active BOOLEAN DEFAULT true,
    escalations_triggered INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_policy ON escalation_rules(sla_policy_id);

-- Enable RLS
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow all for escalation_rules" ON escalation_rules;
    CREATE POLICY "Allow all for escalation_rules" ON escalation_rules FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- 2. Enhanced escalation check function
-- =====================================================
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
BEGIN
    -- Loop through active tickets
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
            g.sla_policy_id,
            ts.status_name
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        WHERE ts.is_final = false
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;

        -- Get SLA targets for this ticket
        FOR v_rule IN
            SELECT er.*, sp.name as policy_name
            FROM escalation_rules er
            LEFT JOIN sla_policies sp ON er.sla_policy_id = sp.id
            WHERE er.is_active = true
              AND (er.sla_policy_id = v_ticket.sla_policy_id OR er.sla_policy_id IS NULL)
            ORDER BY er.trigger_value ASC
        LOOP
            v_should_trigger := false;

            -- Get SLA target minutes based on type
            SELECT COALESCE(target_minutes, 60) INTO v_sla_target_minutes
            FROM sla_targets
            WHERE sla_policy_id = v_ticket.sla_policy_id
              AND sla_type = v_rule.sla_type
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT)
            LIMIT 1;

            IF v_sla_target_minutes IS NULL THEN
                v_sla_target_minutes := 60; -- Default 1 hour
            END IF;

            -- Calculate elapsed minutes
            IF v_rule.sla_type = 'response' AND v_ticket.first_response_at IS NULL THEN
                v_elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;
            ELSIF v_rule.sla_type = 'resolution' THEN
                v_elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;
            ELSE
                CONTINUE; -- Skip if response already given
            END IF;

            -- Check trigger condition
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

            -- Check if already triggered for this ticket
            IF v_should_trigger THEN
                IF EXISTS (
                    SELECT 1 FROM ticket_activity_log
                    WHERE ticket_id = v_ticket.id
                      AND action LIKE '%Escalation: ' || v_rule.name || '%'
                      AND created_at > v_ticket.created_at
                ) THEN
                    v_should_trigger := false; -- Already triggered
                END IF;
            END IF;

            -- Execute actions if should trigger
            IF v_should_trigger THEN
                v_triggered_count := v_triggered_count + 1;

                -- Process each action
                FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions)
                LOOP
                    -- Action: notify_supervisor
                    IF v_action.value->>'type' = 'notify_supervisor' THEN
                        SELECT user_id INTO v_target_user_id
                        FROM group_supervisors
                        WHERE group_id = v_ticket.assignment_group_id
                        LIMIT 1;

                        IF v_target_user_id IS NOT NULL THEN
                            INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                            VALUES (
                                v_target_user_id,
                                '⚠️ SLA Escalation Alert',
                                COALESCE(v_rule.notification_message, 
                                    'Ticket ' || v_ticket.ticket_number || ' has triggered escalation rule: ' || v_rule.name),
                                'escalation',
                                'ticket',
                                v_ticket.id,
                                false,
                                NOW()
                            );
                        END IF;
                    END IF;

                    -- Action: notify_group
                    IF v_action.value->>'type' = 'notify_group' THEN
                        DECLARE
                            v_group_member RECORD;
                            v_notify_group_id UUID;
                        BEGIN
                            v_notify_group_id := COALESCE((v_action.value->>'target_id')::UUID, v_ticket.assignment_group_id);
                            
                            FOR v_group_member IN
                                SELECT gm.user_id 
                                FROM group_members gm 
                                WHERE gm.group_id = v_notify_group_id AND gm.is_active = true
                            LOOP
                                INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                                VALUES (
                                    v_group_member.user_id,
                                    '⚠️ SLA Escalation - Group Alert',
                                    'Ticket ' || v_ticket.ticket_number || ' requires attention.',
                                    'escalation',
                                    'ticket',
                                    v_ticket.id,
                                    false,
                                    NOW()
                                );
                            END LOOP;
                        END;
                    END IF;

                    -- Action: notify_user (specific user)
                    IF v_action.value->>'type' = 'notify_user' THEN
                        v_target_user_id := (v_action.value->>'target_id')::UUID;
                        IF v_target_user_id IS NOT NULL THEN
                            INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                            VALUES (
                                v_target_user_id,
                                '⚠️ SLA Escalation Alert',
                                'Ticket ' || v_ticket.ticket_number || ' has triggered escalation: ' || v_rule.name,
                                'escalation',
                                'ticket',
                                v_ticket.id,
                                false,
                                NOW()
                            );
                        END IF;
                    END IF;

                    -- Action: reassign
                    IF v_action.value->>'type' = 'reassign' THEN
                        v_target_user_id := (v_action.value->>'target_id')::UUID;
                        IF v_target_user_id IS NOT NULL THEN
                            UPDATE tickets
                            SET assigned_to = v_target_user_id,
                                updated_at = NOW()
                            WHERE id = v_ticket.id;
                        END IF;
                    END IF;

                    -- Action: change_priority
                    IF v_action.value->>'type' = 'change_priority' THEN
                        DECLARE
                            v_new_priority TEXT;
                        BEGIN
                            v_new_priority := v_action.value->>'new_priority';
                            IF v_new_priority IS NOT NULL THEN
                                UPDATE tickets
                                SET priority = v_new_priority,
                                    updated_at = NOW()
                                WHERE id = v_ticket.id;
                            END IF;
                        END;
                    END IF;

                    -- Action: add_note
                    IF v_action.value->>'type' = 'add_note' THEN
                        DECLARE
                            v_note_text TEXT;
                        BEGIN
                            v_note_text := COALESCE(v_action.value->>'note_text', 
                                'Auto-escalation triggered: ' || v_rule.name);
                            
                            INSERT INTO ticket_replies (ticket_id, content, is_internal, reply_type, created_at)
                            VALUES (v_ticket.id, v_note_text, true, 'system', NOW());
                        END;
                    END IF;
                END LOOP;

                -- Log the escalation
                INSERT INTO ticket_activity_log (ticket_id, action, actor_id, created_at)
                VALUES (
                    v_ticket.id,
                    'Escalation: ' || v_rule.name || ' triggered (' || v_rule.trigger_type || ' = ' || v_rule.trigger_value || ')',
                    v_ticket.assigned_to,
                    NOW()
                );

                -- Update rule statistics
                UPDATE escalation_rules
                SET escalations_triggered = COALESCE(escalations_triggered, 0) + 1,
                    updated_at = NOW()
                WHERE id = v_rule.id;
            END IF;
        END LOOP;
    END LOOP;

    v_result := jsonb_build_object(
        'success', true,
        'processed', v_processed_count,
        'triggered', v_triggered_count,
        'executed_at', NOW()
    );

    RAISE NOTICE 'Escalation check completed: % tickets processed, % escalations triggered', v_processed_count, v_triggered_count;

    RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_escalation_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION process_escalation_rules() TO service_role;

-- =====================================================
-- 3. Schedule the escalation check (every 5 minutes)
-- =====================================================
-- This runs alongside the existing sla-escalation-check

SELECT cron.schedule(
    'process-escalation-rules',
    '*/5 * * * *',  -- Every 5 minutes
    'SELECT process_escalation_rules()'
);

-- =====================================================
-- 4. Verify installation
-- =====================================================
SELECT 'Enhanced Escalation Rules System installed!' as status;

-- Show scheduled jobs
SELECT jobname, schedule, command, active 
FROM cron.job 
WHERE jobname LIKE '%escalation%';

-- Test the function (comment out after testing)
-- SELECT process_escalation_rules();
