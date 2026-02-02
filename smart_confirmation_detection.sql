-- =====================================================
-- SMART CONFIRMATION DETECTION SYSTEM
-- =====================================================
-- Point A: Detect user confirmation keywords and notify agent
-- Keywords: "Sudah Bisa", "Done"
-- =====================================================

-- 1. Add column to track user confirmation on tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tickets.user_confirmed_at IS 'Timestamp when user sent a confirmation message (e.g., "sudah bisa", "done"). Used for smart reminders and KPI tracking.';

-- 2. Create new notification type for user confirmation
-- (The notification system already supports custom types, 
--  we'll use 'user_confirmed' as the type)

-- 3. Create function to detect confirmation keywords
CREATE OR REPLACE FUNCTION detect_user_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket RECORD;
    v_message_lower TEXT;
    v_is_confirmation BOOLEAN := FALSE;
    v_confirmation_keywords TEXT[] := ARRAY['sudah bisa', 'done'];
    v_keyword TEXT;
BEGIN
    -- Only check messages from requester (user)
    IF NEW.sender_role != 'requester' THEN
        RETURN NEW;
    END IF;

    -- Get ticket info
    SELECT t.*, p.full_name as requester_name 
    INTO v_ticket
    FROM tickets t
    LEFT JOIN profiles p ON t.requester_id = p.id
    WHERE t.id = NEW.ticket_id;

    -- Skip if no assigned agent
    IF v_ticket.assigned_to IS NULL THEN
        RETURN NEW;
    END IF;

    -- Skip if ticket is already resolved/closed/canceled
    IF EXISTS (
        SELECT 1 FROM ticket_statuses ts 
        WHERE ts.status_id = v_ticket.status_id 
        AND ts.status_name IN ('Resolved', 'Closed', 'Canceled')
    ) THEN
        RETURN NEW;
    END IF;

    -- Convert message to lowercase for comparison
    -- Strip HTML tags first if message contains HTML
    v_message_lower := LOWER(
        REGEXP_REPLACE(NEW.content, '<[^>]*>', ' ', 'g')
    );

    -- Check for confirmation keywords
    FOREACH v_keyword IN ARRAY v_confirmation_keywords LOOP
        IF v_message_lower LIKE '%' || v_keyword || '%' THEN
            v_is_confirmation := TRUE;
            EXIT;
        END IF;
    END LOOP;

    -- If confirmation detected, take action
    IF v_is_confirmation THEN
        -- 1. Update ticket with confirmation timestamp (only if not already set)
        IF v_ticket.user_confirmed_at IS NULL THEN
            UPDATE tickets 
            SET user_confirmed_at = NOW() 
            WHERE id = NEW.ticket_id;
        END IF;

        -- 2. Send notification to assigned agent
        PERFORM send_notification(
            v_ticket.assigned_to,
            '🎉 User Konfirmasi Selesai!',
            'User pada tiket ' || v_ticket.ticket_number || ' sudah konfirmasi bahwa masalah teratasi. Segera RESOLVE tiket untuk menutup SLA!',
            'user_confirmed',  -- Special type for styling
            'ticket',
            v_ticket.id::TEXT
        );

        -- 3. Log activity
        INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
        VALUES (
            NEW.ticket_id, 
            'System detected user confirmation message. Auto-reminder sent to agent.', 
            NEW.sender_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger for confirmation detection
DROP TRIGGER IF EXISTS trigger_detect_user_confirmation ON ticket_messages;

CREATE TRIGGER trigger_detect_user_confirmation
    AFTER INSERT ON ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_user_confirmation();

-- =====================================================
-- TEST THE FUNCTION
-- =====================================================
-- To test, insert a message with "sudah bisa" or "done":
--
-- INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message_content)
-- VALUES ('YOUR_TICKET_ID', 'REQUESTER_USER_ID', 'requester', 'Sudah bisa pak, terima kasih!');
--
-- Then check:
-- 1. notifications table - should have new notification for assigned agent
-- 2. tickets.user_confirmed_at - should be set
-- 3. ticket_activity_log - should have new entry

-- =====================================================
-- ADDITIONAL: Function to get tickets with pending resolution
-- =====================================================
-- This helps supervisors/reports identify tickets where user confirmed
-- but agent hasn't resolved yet

CREATE OR REPLACE FUNCTION get_pending_resolution_tickets()
RETURNS TABLE (
    ticket_id UUID,
    ticket_number TEXT,
    subject TEXT,
    assigned_to UUID,
    agent_name TEXT,
    user_confirmed_at TIMESTAMPTZ,
    hours_since_confirmation NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.ticket_number,
        t.subject,
        t.assigned_to,
        p.full_name,
        t.user_confirmed_at,
        ROUND(EXTRACT(EPOCH FROM (NOW() - t.user_confirmed_at)) / 3600, 1)
    FROM tickets t
    LEFT JOIN profiles p ON t.assigned_to = p.id
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE t.user_confirmed_at IS NOT NULL
      AND ts.status_name NOT IN ('Resolved', 'Closed', 'Canceled')
    ORDER BY t.user_confirmed_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_resolution_tickets() TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Smart Confirmation Detection System installed successfully!' as result;

-- Check if trigger exists
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_detect_user_confirmation';
