-- Create junction table for Groups and SLA Policies
CREATE TABLE IF NOT EXISTS group_sla_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, sla_policy_id)
);

-- (Optional) If you previously added sla_policy_id to groups, 
-- you might want to migrate that data if it exists, though it's likely empty now.
-- INSERT INTO group_sla_policies (group_id, sla_policy_id)
-- SELECT id, sla_policy_id FROM groups WHERE sla_policy_id IS NOT NULL;

-- (Optional) Remove the single column if you want to keep it clean.
-- ALTER TABLE groups DROP COLUMN IF EXISTS sla_policy_id;
