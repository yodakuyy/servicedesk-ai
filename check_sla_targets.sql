-- Check sla_targets table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sla_targets'
ORDER BY ordinal_position;

-- If the table doesn't exist or has wrong structure, create/fix it:
-- 
-- CREATE TABLE IF NOT EXISTS sla_targets (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     policy_id UUID REFERENCES sla_policies(id) ON DELETE CASCADE,
--     sla_type VARCHAR(20) NOT NULL CHECK (sla_type IN ('response', 'resolution')),
--     priority VARCHAR(20) NOT NULL,
--     target_minutes INTEGER NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- 
-- -- Or if the column name is different, rename it:
-- ALTER TABLE sla_targets RENAME COLUMN sla_policy_id TO policy_id;
