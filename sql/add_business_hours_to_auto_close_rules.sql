-- Add use_business_hours column to auto_close_rules table
-- When true, the "Close After" timer only counts business hours (excludes holidays, non-working hours)
-- When false (default), uses standard wall-clock time
ALTER TABLE auto_close_rules 
ADD COLUMN IF NOT EXISTS use_business_hours BOOLEAN DEFAULT false;

COMMENT ON COLUMN auto_close_rules.use_business_hours IS 
'When true, the timeout period only counts business hours (respects holidays and work schedules). When false, uses standard wall-clock time.';
