-- =====================================================
-- USER-INITIATED CLOSURE SYSTEM
-- =====================================================
-- Point E: Allow users to close their own tickets
-- Two channels: Portal button + Email link
-- =====================================================

-- 1. Add column to track user-initiated closure
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS closed_by_user BOOLEAN DEFAULT FALSE;

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS closure_token UUID DEFAULT NULL;

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS closure_token_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN tickets.closed_by_user IS 'True if the ticket was closed/resolved by the user (requester) themselves';
COMMENT ON COLUMN tickets.closure_token IS 'One-time token for email-based closure confirmation';
COMMENT ON COLUMN tickets.closure_token_expires_at IS 'Expiration time for the closure token (24 hours default)';

-- 2. Create function to generate closure token
-- This will be called when sending confirmation email to user
CREATE OR REPLACE FUNCTION generate_closure_token(p_ticket_id UUID)
RETURNS UUID AS $$
DECLARE
    v_token UUID;
BEGIN
    -- Generate a new token
    v_token := gen_random_uuid();
    
    -- Update the ticket with the token (valid for 24 hours)
    UPDATE tickets
    SET 
        closure_token = v_token,
        closure_token_expires_at = NOW() + INTERVAL '24 hours'
    WHERE id = p_ticket_id;
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_closure_token(UUID) TO authenticated;

-- 3. Create function for user to close their own ticket (Portal)
CREATE OR REPLACE FUNCTION user_close_ticket(
    p_ticket_id UUID,
    p_user_id UUID,
    p_satisfaction_rating INTEGER DEFAULT NULL,
    p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_resolved_status_id INTEGER;
BEGIN
    -- Get ticket info
    SELECT t.*, ts.status_name
    INTO v_ticket
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE t.id = p_ticket_id;
    
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
    
    -- Get Resolved status ID
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
        resolved_at = NOW(),
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
    
    -- Add system message if feedback provided
    IF p_feedback IS NOT NULL AND p_feedback != '' THEN
        INSERT INTO ticket_messages (ticket_id, sender_role, content)
        VALUES (p_ticket_id, 'system', 'User Feedback: ' || p_feedback);
    END IF;
    
    -- Notify assigned agent that user closed the ticket
    IF v_ticket.assigned_to IS NOT NULL THEN
        PERFORM send_notification(
            v_ticket.assigned_to,
            '✅ Tiket Ditutup oleh User',
            'Requester menutup tiket ' || v_ticket.ticket_number || ' dengan status Resolved.',
            'success',
            'ticket',
            p_ticket_id::TEXT
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket has been closed successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION user_close_ticket(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- 4. Create function to close ticket via email token
CREATE OR REPLACE FUNCTION close_ticket_with_token(
    p_ticket_id UUID,
    p_token UUID
)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_resolved_status_id INTEGER;
BEGIN
    -- Get ticket with token verification
    SELECT t.*, ts.status_name
    INTO v_ticket
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE t.id = p_ticket_id 
      AND t.closure_token = p_token
      AND t.closure_token_expires_at > NOW();
    
    -- Token not found or expired
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired closure link'
        );
    END IF;
    
    -- Check if ticket is already closed
    IF v_ticket.status_name IN ('Resolved', 'Closed', 'Canceled') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ticket is already closed'
        );
    END IF;
    
    -- Get Resolved status ID
    SELECT status_id INTO v_resolved_status_id 
    FROM ticket_statuses 
    WHERE status_name = 'Resolved' 
    LIMIT 1;
    
    -- Update ticket status
    UPDATE tickets
    SET 
        status_id = v_resolved_status_id,
        closed_by_user = TRUE,
        resolved_at = NOW(),
        updated_at = NOW(),
        closure_token = NULL, -- Clear the token after use
        closure_token_expires_at = NULL
    WHERE id = p_ticket_id;
    
    -- Log activity
    INSERT INTO ticket_activity_log (ticket_id, action, actor_id)
    VALUES (
        p_ticket_id, 
        'Ticket closed by requester via email confirmation link',
        v_ticket.requester_id
    );
    
    -- Notify assigned agent
    IF v_ticket.assigned_to IS NOT NULL THEN
        PERFORM send_notification(
            v_ticket.assigned_to,
            '✅ Tiket Ditutup oleh User (via Email)',
            'Requester menutup tiket ' || v_ticket.ticket_number || ' melalui link email.',
            'success',
            'ticket',
            p_ticket_id::TEXT
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket has been closed successfully',
        'ticket_number', v_ticket.ticket_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION close_ticket_with_token(UUID, UUID) TO anon, authenticated;

-- 5. Create function to send closure confirmation to user
-- This is called after user confirms in chat or after agent requests confirmation
CREATE OR REPLACE FUNCTION send_closure_confirmation_request(p_ticket_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_token UUID;
    v_closure_url TEXT;
BEGIN
    -- Get ticket info
    SELECT t.*, p.email as requester_email, p.full_name as requester_name
    INTO v_ticket
    FROM tickets t
    LEFT JOIN profiles p ON t.requester_id = p.id
    WHERE t.id = p_ticket_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
    END IF;
    
    -- Generate closure token
    v_token := generate_closure_token(p_ticket_id);
    
    -- Build closure URL (frontend will handle this)
    -- Format: ?ticketId=xxx&token=xxx
    v_closure_url := '/close-ticket?ticketId=' || p_ticket_id || '&token=' || v_token;
    
    -- Send notification to requester
    PERFORM send_notification(
        v_ticket.requester_id,
        '📋 Konfirmasi Penutupan Tiket',
        'Apakah tiket ' || v_ticket.ticket_number || ' sudah dapat ditutup? Klik untuk konfirmasi.',
        'info',
        'ticket',
        p_ticket_id::TEXT
    );
    
    -- Log activity
    INSERT INTO ticket_activity_log (ticket_id, action)
    VALUES (p_ticket_id, 'Closure confirmation request sent to requester');
    
    RETURN jsonb_build_object(
        'success', true,
        'closure_url', v_closure_url,
        'token', v_token,
        'expires_at', NOW() + INTERVAL '24 hours',
        'requester_email', v_ticket.requester_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_closure_confirmation_request(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'User-Initiated Closure System installed!' as result;

-- Check columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tickets' 
AND column_name IN ('closed_by_user', 'closure_token', 'closure_token_expires_at');
