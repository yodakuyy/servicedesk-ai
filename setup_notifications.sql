-- Notification System Database Setup
-- Run this in Supabase SQL Editor

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info', -- 'info', 'warning', 'success', 'error', 'ticket_new', 'ticket_reply', 'ticket_assigned', 'sla_warning', 'escalation'
    reference_type TEXT, -- 'ticket', 'user', 'sla', etc.
    reference_id TEXT, -- ID of the referenced entity (ticket_id, etc.)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Users can only see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow insert for authenticated users (system will insert on their behalf)
DROP POLICY IF EXISTS "Allow insert for authenticated" ON notifications;
CREATE POLICY "Allow insert for authenticated" ON notifications
    FOR INSERT WITH CHECK (true);

-- Allow delete for own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Grant permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO anon;

-- 6. Enable Realtime for notifications table
-- This allows real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 7. Create a function to send notification (helper)
CREATE OR REPLACE FUNCTION send_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'info',
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (p_user_id, p_title, p_message, p_type, p_reference_type, p_reference_id)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger to auto-notify agent when ticket is created
CREATE OR REPLACE FUNCTION notify_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_id UUID;
    v_ticket_number TEXT;
BEGIN
    -- Get assigned agent
    v_agent_id := NEW.assigned_to;
    v_ticket_number := NEW.ticket_number;
    
    -- If ticket has assigned agent, notify them
    IF v_agent_id IS NOT NULL THEN
        PERFORM send_notification(
            v_agent_id,
            'Tiket Baru Ditugaskan',
            'Tiket ' || v_ticket_number || ' telah ditugaskan kepada Anda.',
            'ticket_assigned',
            'ticket',
            NEW.id::TEXT
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_new_ticket ON tickets;

-- Create trigger
CREATE TRIGGER trigger_notify_new_ticket
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_ticket();

-- 9. Create trigger to notify agent when user replies
CREATE OR REPLACE FUNCTION notify_on_ticket_reply()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket RECORD;
    v_sender_name TEXT;
BEGIN
    -- Get ticket info
    SELECT t.*, p.full_name as requester_name 
    INTO v_ticket
    FROM tickets t
    LEFT JOIN profiles p ON t.requester_id = p.id
    WHERE t.id = NEW.ticket_id;
    
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
            v_ticket.id::TEXT
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
            v_ticket.id::TEXT
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_ticket_reply ON ticket_messages;

-- Create trigger (only if ticket_messages table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_messages') THEN
        CREATE TRIGGER trigger_notify_ticket_reply
            AFTER INSERT ON ticket_messages
            FOR EACH ROW
            EXECUTE FUNCTION notify_on_ticket_reply();
    END IF;
END $$;

-- 10. Verify table creation
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- =====================================================
-- TEST NOTIFICATIONS (Run these to test realtime toast)
-- =====================================================
-- Replace 'YOUR_USER_ID' with actual user UUID from profiles table

-- To get your user ID, run:
-- SELECT id, full_name, email FROM profiles LIMIT 10;

-- Then run one of these to test toast notification:

-- Test 1: Ticket Assigned notification
-- INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
-- VALUES ('YOUR_USER_ID', 'Tiket Baru Ditugaskan', 'Tiket INC-00123 telah ditugaskan kepada Anda.', 'ticket_assigned', 'ticket', 'some-ticket-id');

-- Test 2: Ticket Reply notification  
-- INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
-- VALUES ('YOUR_USER_ID', 'Balasan Baru dari User', 'John Doe membalas tiket INC-00123', 'ticket_reply', 'ticket', 'some-ticket-id');

-- Test 3: SLA Warning notification
-- INSERT INTO notifications (user_id, title, message, type)
-- VALUES ('YOUR_USER_ID', 'Peringatan SLA', 'Tiket INC-00123 sudah mencapai 80% batas waktu response.', 'sla_warning');

-- Test 4: Success notification
-- INSERT INTO notifications (user_id, title, message, type)
-- VALUES ('YOUR_USER_ID', 'Tiket Berhasil Diselesaikan', 'Tiket INC-00123 telah ditutup.', 'success');
