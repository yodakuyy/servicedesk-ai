-- ==============================================================================
-- FIX RELATIONSHIPS & AI INSIGHTS PERMISSIONS
-- ==============================================================================

-- 1. Ensure Foreign Key exists for tickets.status_id -> ticket_statuses.status_id
-- We do this so Supabase can perform JOINS for the Ticket List view.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_tickets_status' 
        AND table_name = 'tickets'
    ) THEN
        ALTER TABLE public.tickets 
        ADD CONSTRAINT fk_tickets_status 
        FOREIGN KEY (status_id) 
        REFERENCES public.ticket_statuses(status_id);
    END IF;
END $$;

-- 2. Fix RLS for ticket_ai_insights
ALTER TABLE public.ticket_ai_insights ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ticket_ai_insights TO authenticated;
GRANT ALL ON public.ticket_ai_insights TO service_role;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.ticket_ai_insights;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.ticket_ai_insights;

CREATE POLICY "Enable insert for authenticated users"
ON public.ticket_ai_insights
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users"
ON public.ticket_ai_insights
FOR SELECT
TO authenticated
USING (true);

-- 3. Check for Enum constraints in ticket_ai_insights
-- If confidence_level is an enum, we make sure 'high', 'medium', 'low' are allowed.
-- For now, we just ensure permissions are set.

-- 4. Fix sequence permissions for good measure
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
