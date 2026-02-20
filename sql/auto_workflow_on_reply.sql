-- =====================================================
-- ZERO TOUCH WORKFLOW: AUTO STATUS ON REPLY
-- =====================================================
-- 1. Agent Reply -> 'Pending - Waiting For Requester' (Pause SLA)
-- 2. Requester Reply -> 'In Progress' (Resume SLA)
-- 3. Set first_response_at for Agent's first reply
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION handle_auto_status_on_reply()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_role_id UUID;
    v_requester_role_id UUID;
    v_in_progress_status_id UUID;
    v_pending_user_status_id UUID;
    v_current_status_name TEXT;
    v_sender_role TEXT;
BEGIN
    -- 1. Get Status IDs
    SELECT status_id INTO v_in_progress_status_id FROM ticket_statuses WHERE status_name = 'In Progress' LIMIT 1;
    SELECT status_id INTO v_pending_user_status_id FROM ticket_statuses WHERE status_name = 'Pending - Waiting For Requester' LIMIT 1;

    -- 2. Get Current Ticket Status
    SELECT ts.status_name INTO v_current_status_name 
    FROM tickets t
    JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE t.id = NEW.ticket_id;

    -- 3. Identify Sender Role (from the message or profiles)
    -- NEW.sender_role is available in ticket_messages
    v_sender_role := NEW.sender_role;

    -- Skip if it's an internal note (is_internal column)
    IF NEW.is_internal = TRUE THEN
        RETURN NEW;
    END IF;

    -- AGENT REPLY LOGIC
    IF v_sender_role = 'agent' THEN
        -- A. Update Status to Pending (Zero Touch)
        -- Only if current status is In Progress or Open
        IF v_current_status_name IN ('Open', 'In Progress') AND v_pending_user_status_id IS NOT NULL THEN
            UPDATE tickets 
            SET status_id = v_pending_user_status_id,
                updated_at = NOW()
            WHERE id = NEW.ticket_id;
        END IF;

        -- B. Set first_reply_at/first_response_at if null
        UPDATE tickets 
        SET first_response_at = COALESCE(first_response_at, NOW())
        WHERE id = NEW.ticket_id AND first_response_at IS NULL;
    
    -- REQUESTER REPLY LOGIC
    ELSIF v_sender_role = 'requester' THEN
        -- If ticket is Resolved or Pending, move back to In Progress
        IF (v_current_status_name = 'Resolved' OR v_current_status_name LIKE 'Pending%') AND v_in_progress_status_id IS NOT NULL THEN
            UPDATE tickets 
            SET status_id = v_in_progress_status_id,
                updated_at = NOW()
            WHERE id = NEW.ticket_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS trg_auto_workflow_on_reply ON ticket_messages;
CREATE TRIGGER trg_auto_workflow_on_reply
    AFTER INSERT ON ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_auto_status_on_reply();

COMMIT;

SELECT 'Zero Touch Workflow automation installed successfully!' as result;
