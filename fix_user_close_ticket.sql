-- Fix user_close_ticket function: change status_id type from INTEGER to UUID
-- Run this in Supabase SQL Editor

-- First, add satisfaction_rating column if it doesn't exist
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_feedback TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_by_user BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION user_close_ticket(
    p_ticket_id UUID,
    p_user_id UUID,
    p_satisfaction_rating INTEGER DEFAULT NULL,
    p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_resolved_status_id UUID;  -- Changed from INTEGER to UUID
BEGIN
    -- Get ticket info
    SELECT t.*, ts.status_name
    INTO v_ticket
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE t.id = p_ticket_id;
    
    -- Verify ticket exists
    IF v_ticket IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ticket not found'
        );
    END IF;
    
    -- Verify user is the requester
    IF v_ticket.requester_id != p_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You can only close your own tickets'
        );
    END IF;
    
    -- Check if ticket is already closed
    IF v_ticket.status_name IN ('Resolved', 'Closed', 'Canceled') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ticket is already closed'
        );
    END IF;
    
    -- Get Resolved status ID (now properly as UUID)
    SELECT status_id INTO v_resolved_status_id 
    FROM ticket_statuses 
    WHERE status_name = 'Resolved' 
    LIMIT 1;
    
    IF v_resolved_status_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Resolved status not found in system'
        );
    END IF;
    
    -- Update ticket status to Resolved
    UPDATE tickets
    SET 
        status_id = v_resolved_status_id,
        closed_by_user = TRUE,
        updated_at = NOW()
    WHERE id = p_ticket_id;
    
    -- Log activity
    INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
    VALUES (
        p_ticket_id, 
        'Ticket closed by requester via portal' || 
        CASE WHEN p_satisfaction_rating IS NOT NULL THEN ' (Rating: ' || p_satisfaction_rating || '/5)' ELSE '' END,
        p_user_id
    );
    
    -- Store satisfaction rating and feedback if provided
    IF p_satisfaction_rating IS NOT NULL OR (p_feedback IS NOT NULL AND p_feedback != '') THEN
        UPDATE tickets
        SET 
            satisfaction_rating = COALESCE(p_satisfaction_rating, satisfaction_rating),
            user_feedback = COALESCE(NULLIF(p_feedback, ''), user_feedback)
        WHERE id = p_ticket_id;
    END IF;
    
    -- Add system message if feedback provided
    IF p_feedback IS NOT NULL AND p_feedback != '' THEN
        INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, content)
        VALUES (p_ticket_id, p_user_id, 'requester', '📝 User Feedback: ' || p_feedback);
    END IF;
    
    -- Notify assigned agent that user closed the ticket
    IF v_ticket.assigned_to IS NOT NULL THEN
        PERFORM send_notification(
            v_ticket.assigned_to,
            'Ticket Closed by User',
            'Ticket #' || v_ticket.ticket_number || ' was resolved by the requester.',
            'success',
            'ticket',
            p_ticket_id::TEXT
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket closed successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION user_close_ticket(UUID, UUID, INTEGER, TEXT) TO authenticated;
