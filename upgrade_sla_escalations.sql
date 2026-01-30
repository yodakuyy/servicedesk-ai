-- Upgrade sla_escalations table to match UI requirements
-- Run this in the Supabase SQL Editor

-- 1. First, let's make sure the columns exist. 
-- We'll add them if they don't exist, and we won't drop existing ones to avoid data loss.

ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES sla_policies(id);
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS sla_type TEXT; -- 'response' or 'resolution'
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'percentage'; -- 'percentage' or 'overdue_minutes'
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS trigger_value INTEGER;
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT '{in_app}';
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS notification_message TEXT;
ALTER TABLE sla_escalations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Migrate data from old columns if they exist (Helper step)
-- If you had data in 'trigger_percentage', move it to 'trigger_value'
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sla_escalations' AND column_name='trigger_percentage') THEN
        UPDATE sla_escalations SET trigger_value = trigger_percentage WHERE trigger_value IS NULL;
    END IF;

    -- If you had data in 'sla_policy_id' (old name), move it to 'policy_id' if policy_id is null
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sla_escalations' AND column_name='sla_policy_id') THEN
        UPDATE sla_escalations SET policy_id = sla_policy_id WHERE policy_id IS NULL;
    END IF;
END $$;

-- 3. Clean up: Rename policy_id back to match the UI code which uses 'policy_id' internally 
-- but might expect it as 'policy_id' in the DB. 
-- The UI code specifically uses .from('sla_escalations').select('*, policy:policy_id(id, name)')
-- So 'policy_id' is the correct column name.

-- 4. Add some initial clean data to test (Optional - you can skip this and create via UI)
-- DELETE FROM sla_escalations; -- Uncomment if you want to clear old incompatible data

-- 5. Final check of the structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sla_escalations';
