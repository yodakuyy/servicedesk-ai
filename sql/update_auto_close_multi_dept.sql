-- =====================================================
-- Auto Close Rules - Multi-Department Support
-- =====================================================

BEGIN;

-- 1. Upgrade company_id to be an array of IDs
-- If company_id was INT, we convert it to INT[]
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auto_close_rules' AND column_name = 'company_id' AND data_type = 'integer') THEN
        ALTER TABLE public.auto_close_rules RENAME COLUMN company_id TO old_company_id;
        ALTER TABLE public.auto_close_rules ADD COLUMN company_ids INT[];
        
        -- Migrate old data: Single ID becomes Array with 1 item
        UPDATE public.auto_close_rules SET company_ids = ARRAY[old_company_id] WHERE old_company_id IS NOT NULL;
        
        ALTER TABLE public.auto_close_rules DROP COLUMN old_company_id;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auto_close_rules' AND column_name = 'company_ids') THEN
        ALTER TABLE public.auto_close_rules ADD COLUMN company_ids INT[];
    END IF;
END $$;

-- 2. Update the processing function to respect multiple company_ids
CREATE OR REPLACE FUNCTION process_auto_close_rules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule RECORD;
    v_ticket RECORD;
    v_closed_status_id INT;
    v_cutoff_time TIMESTAMPTZ;
    v_rule_processed INT := 0;
    v_rule_closed INT := 0;
    v_total_processed INT := 0;
    v_total_closed INT := 0;
    v_result jsonb;
BEGIN
    -- Get the "Closed" status ID
    SELECT status_id INTO v_closed_status_id
    FROM ticket_statuses
    WHERE is_final = true
    LIMIT 1;

    IF v_closed_status_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No closed status found',
            'processed', 0,
            'closed', 0
        );
    END IF;

    -- Loop through all active auto-close rules
    FOR v_rule IN 
        SELECT * FROM auto_close_rules 
        WHERE is_active = true
    LOOP
        v_rule_processed := 0;
        v_rule_closed := 0;

        -- Calculate cutoff time based on rule's after_days and after_hours
        v_cutoff_time := NOW() - (v_rule.after_days || ' days')::INTERVAL 
                                - (v_rule.after_hours || ' hours')::INTERVAL;

        -- Process based on condition type
        -- We JOIN with ticket_categories to check the department (company_id)
        IF v_rule.condition_type = 'status' THEN
            -- Close tickets in specific status
            FOR v_ticket IN
                SELECT t.id, t.ticket_number, t.requester_id, t.assigned_to, tc.company_id AS ticket_company_id
                FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.status_id
                JOIN ticket_categories tc ON t.category_id = tc.id
                WHERE ts.status_name ILIKE v_rule.condition_value
                  AND ts.is_final = false
                  AND t.updated_at <= v_cutoff_time
                  -- Check if ticket's company_id is in rule's company_ids array
                  AND (v_rule.company_ids IS NULL OR tc.company_id = ANY(v_rule.company_ids))
            LOOP
                -- Close the ticket
                UPDATE tickets
                SET status_id = v_closed_status_id,
                    updated_at = NOW()
                WHERE id = v_ticket.id;

                -- Add note if configured
                IF v_rule.add_note AND v_rule.note_text IS NOT NULL THEN
                    INSERT INTO ticket_replies (ticket_id, content, is_internal, reply_type, created_at)
                    VALUES (v_ticket.id, v_rule.note_text, true, 'system', NOW());
                END IF;

                -- Notify user if configured
                IF v_rule.notify_user AND v_ticket.requester_id IS NOT NULL THEN
                    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at, company_id)
                    VALUES (v_ticket.requester_id, 'Ticket Auto-Closed', 
                           'Ticket ' || v_ticket.ticket_number || ' has been automatically closed due to inactivity.',
                           'ticket_closed', 'ticket', v_ticket.id, false, NOW(), v_ticket.ticket_company_id);
                END IF;

                -- Notify agent if configured
                IF v_rule.notify_agent AND v_ticket.assigned_to IS NOT NULL THEN
                    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at, company_id)
                    VALUES (v_ticket.assigned_to, 'Ticket Auto-Closed', 
                           'Ticket ' || v_ticket.ticket_number || ' was auto-closed by rule: ' || v_rule.name,
                           'ticket_closed', 'ticket', v_ticket.id, false, NOW(), v_ticket.ticket_company_id);
                END IF;

                v_rule_closed := v_rule_closed + 1;
                v_total_closed := v_total_closed + 1;
            END LOOP;

        ELSIF v_rule.condition_type = 'pending' THEN
            -- Close tickets in any pending status
            FOR v_ticket IN
                SELECT t.id, t.ticket_number, t.requester_id, t.assigned_to, tc.company_id AS ticket_company_id
                FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.status_id
                JOIN ticket_categories tc ON t.category_id = tc.id
                WHERE ts.status_name ILIKE '%pending%'
                  AND ts.is_final = false
                  AND t.updated_at <= v_cutoff_time
                  AND (v_rule.company_ids IS NULL OR tc.company_id = ANY(v_rule.company_ids))
            LOOP
                UPDATE tickets
                SET status_id = v_closed_status_id,
                    updated_at = NOW()
                WHERE id = v_ticket.id;

                IF v_rule.add_note AND v_rule.note_text IS NOT NULL THEN
                    INSERT INTO ticket_replies (ticket_id, content, is_internal, reply_type, created_at)
                    VALUES (v_ticket.id, v_rule.note_text, true, 'system', NOW());
                END IF;

                IF v_rule.notify_user AND v_ticket.requester_id IS NOT NULL THEN
                    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at, company_id)
                    VALUES (v_ticket.requester_id, 'Ticket Auto-Closed', 
                            'Ticket ' || v_ticket.ticket_number || ' has been automatically closed.',
                            'ticket_closed', 'ticket', v_ticket.id, false, NOW(), v_ticket.ticket_company_id);
                END IF;

                v_rule_closed := v_rule_closed + 1;
                v_total_closed := v_total_closed + 1;
            END LOOP;
        
        ELSIF v_rule.condition_type = 'user_confirmed' THEN
             -- Specific logic for when user has confirmed resolution but ticket is still 'Resolved' and not 'Closed'
             FOR v_ticket IN
                SELECT t.id, t.ticket_number, t.requester_id, t.assigned_to
                FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.status_id
                JOIN ticket_categories tc ON t.category_id = tc.id
                WHERE ts.status_name ILIKE 'Resolved'
                  AND t.is_user_confirmed = true
                  AND t.updated_at <= v_cutoff_time
                  AND (v_rule.company_ids IS NULL OR tc.company_id = ANY(v_rule.company_ids))
            LOOP
                UPDATE tickets
                SET status_id = v_closed_status_id,
                    updated_at = NOW()
                WHERE id = v_ticket.id;

                v_rule_closed := v_rule_closed + 1;
                v_total_closed := v_total_closed + 1;
            END LOOP;
        END IF;

        -- Update rule statistics
        IF v_rule_closed > 0 THEN
            UPDATE auto_close_rules
            SET tickets_closed = COALESCE(tickets_closed, 0) + v_rule_closed,
                updated_at = NOW()
            WHERE id = v_rule.id;
        END IF;
    END LOOP;

    -- Return result
    v_result := jsonb_build_object(
        'success', true,
        'processed', v_total_processed,
        'closed', v_total_closed,
        'executed_at', NOW()
    );

    RETURN v_result;
END;
$$;

COMMIT;
