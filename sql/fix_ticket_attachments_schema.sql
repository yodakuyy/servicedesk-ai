-- Add file_size column to ticket_attachments table
-- This column is required by AgentTicketView.tsx but was missing in the schema.

ALTER TABLE public.ticket_attachments 
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Refresh PostgREST cache (optional, usually happens automatically)
-- NOTIFY pgrst, 'reload schema';
