-- Fix SLA Tables Permissions
-- Run this in Supabase SQL Editor

-- Enable RLS on SLA tables
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_escalations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all access to sla_policies" ON sla_policies;
DROP POLICY IF EXISTS "Allow all access to sla_targets" ON sla_targets;
DROP POLICY IF EXISTS "Allow all access to sla_escalations" ON sla_escalations;

-- Create permissive policies for authenticated users
CREATE POLICY "Allow all access to sla_policies" ON sla_policies
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to sla_targets" ON sla_targets
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to sla_escalations" ON sla_escalations
    FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON sla_policies TO authenticated;
GRANT ALL ON sla_policies TO anon;
GRANT ALL ON sla_targets TO authenticated;
GRANT ALL ON sla_targets TO anon;
GRANT ALL ON sla_escalations TO authenticated;
GRANT ALL ON sla_escalations TO anon;

-- Verify tables exist and show structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sla_policies' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sla_targets' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sla_escalations' 
ORDER BY ordinal_position;
