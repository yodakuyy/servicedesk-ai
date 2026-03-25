-- Add target_status_id column to auto_close_rules table
-- status_id in ticket_statuses is UUID type, so we use UUID here
ALTER TABLE auto_close_rules 
ADD COLUMN IF NOT EXISTS target_status_id UUID REFERENCES ticket_statuses(status_id);

COMMENT ON COLUMN auto_close_rules.target_status_id IS 
'Optional target status for the rule. If NULL, defaults to the final "Closed" status. Set to "Resolved" status_id to auto-resolve instead of auto-close.';
