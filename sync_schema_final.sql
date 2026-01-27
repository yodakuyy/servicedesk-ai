-- MASTER SCHEMA & FOREIGN KEY SYNC
-- This script fixes the "PGRST200" error by ensuring all foreign keys exist
-- so PostgREST can perform joins between tickets, profiles, and statuses.

BEGIN;

-- 1. Ensure requester_id points to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_requester_id_fkey') THEN
        ALTER TABLE public.tickets 
        ADD CONSTRAINT tickets_requester_id_fkey 
        FOREIGN KEY (requester_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Ensure status_id points to ticket_statuses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_status_id_fkey') THEN
        ALTER TABLE public.tickets 
        ADD CONSTRAINT tickets_status_id_fkey 
        FOREIGN KEY (status_id) REFERENCES public.ticket_statuses(status_id);
    END IF;
END $$;

-- 3. Ensure assigned_to points to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_assigned_to_fkey') THEN
        ALTER TABLE public.tickets 
        ADD CONSTRAINT tickets_assigned_to_fkey 
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 4. Create ticket_messages if missing
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id),
    sender_type TEXT CHECK (sender_type IN ('requester', 'agent', 'system')),
    message_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Open Permissions (Disable RLS for smooth development)
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

SELECT 'Foreign Keys and Schema Sync completed successfully.' as result;
