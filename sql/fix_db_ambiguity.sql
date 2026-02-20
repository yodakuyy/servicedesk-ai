-- CRITICAL DATABASE CLEANUP
-- This script removes duplicate foreign keys that are causing "PGRST201" errors.

BEGIN;

-- 1. Rationalize ticket_statuses relationship
-- We found two constraints: 'fk_tickets_status' and 'tickets_status_id_fkey'
-- Let's keep 'fk_tickets_status' and drop the other.
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_id_fkey;

-- 2. Rationalize profiles relationship (requester)
-- Ensure only one official FK exists for requester_id
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_requester_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT fk_tickets_requester 
    FOREIGN KEY (requester_id) REFERENCES public.profiles(id);

-- 3. Rationalize profiles relationship (assigned_to)
-- Ensure only one official FK exists for assigned_to
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT fk_tickets_assigned_agent 
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);

COMMIT;

SELECT 'Database foreign keys rationalized. Ambiguity removed.' as result;
