-- Add sla_policy_id to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS sla_policy_id UUID REFERENCES sla_policies(id);
