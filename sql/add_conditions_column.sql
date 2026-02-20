-- Add conditions column to sla_policies table
-- This column stores the SLA conditions as JSONB (array of condition objects)

-- Add the column
ALTER TABLE sla_policies 
ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN sla_policies.conditions IS 'Array of condition objects: [{field, operator, value}]';

-- Example of conditions structure:
-- [
--   {"field": "company", "operator": "equals", "value": "DIT"},
--   {"field": "ticket_type", "operator": "equals", "value": "Incident"},
--   {"field": "priority", "operator": "in", "value": ["Urgent", "High"]}
-- ]

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sla_policies' AND column_name = 'conditions';
