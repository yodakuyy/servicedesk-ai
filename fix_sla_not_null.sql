-- Make response_time_minutes nullable to support new table structure
-- Run this in Supabase SQL Editor

ALTER TABLE sla_targets ALTER COLUMN response_time_minutes DROP NOT NULL;
