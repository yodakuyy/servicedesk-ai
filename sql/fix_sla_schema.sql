-- Fix sla_targets table schema
-- Run this in the Supabase SQL Editor

-- 1. Add the missing 'sla_type' column
ALTER TABLE sla_targets ADD COLUMN IF NOT EXISTS sla_type TEXT;

-- 2. Rename policy_id to sla_policy_id if it exists (matching the code)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sla_targets' AND column_name = 'policy_id') THEN
        ALTER TABLE sla_targets RENAME COLUMN policy_id TO sla_policy_id;
    END IF;
END $$;

-- 3. Verify other columns
ALTER TABLE sla_targets ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE sla_targets ADD COLUMN IF NOT EXISTS target_minutes INTEGER;

-- 4. Clean up any bad data
DELETE FROM sla_targets WHERE sla_type IS NULL;
