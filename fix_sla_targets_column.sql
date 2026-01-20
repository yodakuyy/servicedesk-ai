-- Add target_minutes column to sla_targets table
-- Run this in the Supabase SQL Editor

ALTER TABLE sla_targets ADD COLUMN IF NOT EXISTS target_minutes INTEGER;

-- Optional: You can drop the unused columns if you want to clean up
-- ALTER TABLE sla_targets DROP COLUMN IF EXISTS response_time;
-- ALTER TABLE sla_targets DROP COLUMN IF EXISTS resolution_time;
