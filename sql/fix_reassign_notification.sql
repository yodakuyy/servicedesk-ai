-- FIX REASSIGN NOTIFICATION
-- This script adds a trigger to notify agents when a ticket is assigned or reassigned to them.

BEGIN;

-- 1. Create or Replace the notification function for updates
CREATE OR REPLACE FUNCTION public.notify_on_ticket_reassign()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
BEGIN
    -- Only notify if the assigned_to agent has changed AND is not null
    IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND (NEW.assigned_to IS NOT NULL) THEN
        
        -- Default title and message
        v_notification_title := 'Tiket Baru Ditugaskan';
        v_notification_message := 'Tiket ' || NEW.ticket_number || ' telah ditugaskan kepada Anda.';

        -- If the assignment was done by a specific user (not system/trigger)
        -- auth.uid() gives the ID of the current authenticated user making the request
        IF auth.uid() IS NOT NULL THEN
            -- Only add sender context if it's NOT a self-assignment
            IF NEW.assigned_to != auth.uid() THEN
                SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = auth.uid();
                
                IF v_sender_name IS NOT NULL THEN
                    v_notification_title := 'Tiket Ditugaskan ke Anda';
                    v_notification_message := 'Tiket ' || NEW.ticket_number || ' telah ditugaskan/di-reassign oleh ' || v_sender_name;
                END IF;
            ELSE
                -- Skip notification if agent is assigning the ticket to themselves
                RETURN NEW;
            END IF;
        END IF;

        -- Send the notification using the existing helper
        -- This helper respects user preferences (New Ticket Assigned setting)
        PERFORM public.send_notification(
            NEW.assigned_to,
            v_notification_title,
            v_notification_message,
            'ticket_assigned',
            'ticket',
            NEW.id::TEXT
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if it exists to avoid duplicates
DROP TRIGGER IF EXISTS trigger_notify_ticket_reassign ON public.tickets;

-- 3. Create the trigger for UPDATE on assigned_to column
CREATE TRIGGER trigger_notify_ticket_reassign
    AFTER UPDATE OF assigned_to ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_ticket_reassign();

COMMIT;

SELECT 'Reassignment notification trigger successfully installed/updated.' as result;
