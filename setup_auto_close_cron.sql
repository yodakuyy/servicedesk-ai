-- =====================================================
-- Auto Close Rules - Database Function for pg_cron
-- =====================================================
-- This function processes all active auto-close rules
-- and closes tickets that match the conditions.
-- Schedule to run every hour or as needed.
-- =====================================================

-- Create or replace the auto-close function
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
        -- Calculate cutoff time based on rule's after_days and after_hours
        v_cutoff_time := NOW() - (v_rule.after_days || ' days')::INTERVAL 
                                - (v_rule.after_hours || ' hours')::INTERVAL;

        -- Process based on condition type
        IF v_rule.condition_type = 'status' THEN
            -- Close tickets in specific status
            FOR v_ticket IN
                SELECT t.id, t.ticket_number, t.requester_id, t.assigned_to
                FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.status_id
                WHERE ts.status_name ILIKE v_rule.condition_value
                  AND ts.is_final = false
                  AND t.updated_at <= v_cutoff_time
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
                    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                    VALUES (
                        v_ticket.requester_id,
                        'Ticket Auto-Closed',
                        'Ticket ' || v_ticket.ticket_number || ' has been automatically closed due to inactivity.',
                        'ticket_closed',
                        'ticket',
                        v_ticket.id,
                        false,
                        NOW()
                    );
                END IF;

                -- Notify agent if configured
                IF v_rule.notify_agent AND v_ticket.assigned_to IS NOT NULL THEN
                    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                    VALUES (
                        v_ticket.assigned_to,
                        'Ticket Auto-Closed',
                        'Ticket ' || v_ticket.ticket_number || ' was auto-closed by rule: ' || v_rule.name,
                        'ticket_closed',
                        'ticket',
                        v_ticket.id,
                        false,
                        NOW()
                    );
                END IF;

                v_total_closed := v_total_closed + 1;
                v_total_processed := v_total_processed + 1;
            END LOOP;

        ELSIF v_rule.condition_type = 'pending' THEN
            -- Close tickets in any pending status
            FOR v_ticket IN
                SELECT t.id, t.ticket_number, t.requester_id, t.assigned_to
                FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.status_id
                WHERE ts.status_name ILIKE '%pending%'
                  AND ts.is_final = false
                  AND t.updated_at <= v_cutoff_time
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
                    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
                    VALUES (v_ticket.requester_id, 'Ticket Auto-Closed', 
                            'Ticket ' || v_ticket.ticket_number || ' has been automatically closed.',
                            'ticket_closed', 'ticket', v_ticket.id, false, NOW());
                END IF;

                v_total_closed := v_total_closed + 1;
                v_total_processed := v_total_processed + 1;
            END LOOP;
        END IF;

        -- Update rule statistics
        IF v_total_closed > 0 THEN
            UPDATE auto_close_rules
            SET tickets_closed = COALESCE(tickets_closed, 0) + v_total_closed,
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

    -- Log the execution
    RAISE NOTICE 'Auto-close completed: % processed, % closed', v_total_processed, v_total_closed;

    RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_auto_close_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION process_auto_close_rules() TO service_role;

-- =====================================================
-- Schedule the cron job to run every hour
-- =====================================================
-- Note: Uncomment the line below to add the cron job

SELECT cron.schedule(
    'auto-close-check',           -- Job name
    '0 * * * *',                  -- Every hour at minute 0
    'SELECT process_auto_close_rules()'
);

-- To check if job was added:
-- SELECT * FROM cron.job WHERE jobname = 'auto-close-check';

-- To unschedule (if needed):
-- SELECT cron.unschedule('auto-close-check');

-- To run immediately for testing:
-- SELECT process_auto_close_rules();
