-- =============================================================================
-- AUTOMATION TABLES FOR SERVICEDESK
-- Tables for: Auto Assignment, Auto Close Rules, and Notification Settings
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AUTO ASSIGNMENT RULES TABLE
-- Used by: AutoAssignment.tsx
-- Purpose: Store rules for automatic ticket routing
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auto_assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Conditions stored as JSONB array
    -- Format: [{ "field": "category", "operator": "equals", "value": "Network" }, ...]
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Assignment target
    assign_to_type VARCHAR(20) NOT NULL CHECK (assign_to_type IN ('group', 'agent', 'round_robin')),
    assign_to_id UUID, -- References groups.id or profiles.id depending on type
    assign_to_name VARCHAR(255), -- Cached name for display
    
    -- Rule priority (lower = higher priority)
    priority INTEGER NOT NULL DEFAULT 100,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Stats
    tickets_routed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id)
);

-- Index for faster lookup of active rules by priority
CREATE INDEX IF NOT EXISTS idx_auto_assignment_rules_active_priority 
    ON auto_assignment_rules(is_active, priority) 
    WHERE is_active = true;

-- Add comment
COMMENT ON TABLE auto_assignment_rules IS 'Stores rules for automatic ticket assignment/routing';
COMMENT ON COLUMN auto_assignment_rules.conditions IS 'JSON array of conditions: [{field, operator, value}]';
COMMENT ON COLUMN auto_assignment_rules.assign_to_type IS 'group=assign to group, agent=specific agent, round_robin=distribute evenly';


-- -----------------------------------------------------------------------------
-- 2. AUTO CLOSE RULES TABLE
-- Used by: AutoCloseRules.tsx
-- Purpose: Store rules for automatic ticket closure
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auto_close_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Condition for closing
    condition_type VARCHAR(20) NOT NULL CHECK (condition_type IN ('status', 'user_confirmed', 'no_response', 'pending')),
    condition_value VARCHAR(255) NOT NULL, -- e.g., status name, 'customer', 'agent'
    
    -- Time period before auto-close
    after_days INTEGER NOT NULL DEFAULT 3,
    after_hours INTEGER NOT NULL DEFAULT 0,
    
    -- Notification settings
    notify_user BOOLEAN NOT NULL DEFAULT true,
    notify_agent BOOLEAN NOT NULL DEFAULT false,
    
    -- Add note on closure
    add_note BOOLEAN NOT NULL DEFAULT false,
    note_text TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Stats
    tickets_closed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id)
);

-- Index for active rules
CREATE INDEX IF NOT EXISTS idx_auto_close_rules_active 
    ON auto_close_rules(is_active) 
    WHERE is_active = true;

-- Add comment
COMMENT ON TABLE auto_close_rules IS 'Stores rules for automatic ticket closure';
COMMENT ON COLUMN auto_close_rules.condition_type IS 'status=when status is X, user_confirmed=when user confirms, no_response=no response from X, pending=pending for X time';


-- -----------------------------------------------------------------------------
-- 3. NOTIFICATION SETTINGS TABLE
-- Used by: NotificationSettings.tsx
-- Purpose: Store notification preferences per role/category
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target role
    role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('agent', 'customer', 'supervisor')),
    
    -- Setting identification
    setting_key VARCHAR(100) NOT NULL, -- e.g., 'new_ticket_assigned', 'ticket_reply', etc.
    setting_label VARCHAR(255) NOT NULL,
    setting_description TEXT,
    setting_icon VARCHAR(50), -- Lucide icon name
    
    -- Master enable/disable
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Channel toggles
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    push_enabled BOOLEAN NOT NULL DEFAULT false,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint per role and setting
    CONSTRAINT unique_role_setting UNIQUE (role_type, setting_key)
);

-- Index for faster lookup by role
CREATE INDEX IF NOT EXISTS idx_notification_settings_role 
    ON notification_settings(role_type);

-- Add comment
COMMENT ON TABLE notification_settings IS 'Global notification settings per role type';


-- -----------------------------------------------------------------------------
-- 4. USER NOTIFICATION PREFERENCES (Optional - for per-user overrides)
-- Purpose: Allow individual users to override global notification settings
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    
    -- Override values (NULL means use global setting)
    is_enabled BOOLEAN,
    email_enabled BOOLEAN,
    push_enabled BOOLEAN,
    in_app_enabled BOOLEAN,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint per user and setting
    CONSTRAINT unique_user_setting UNIQUE (user_id, setting_key)
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user 
    ON user_notification_preferences(user_id);

-- Add comment
COMMENT ON TABLE user_notification_preferences IS 'Per-user notification preference overrides';


-- =============================================================================
-- INSERT DEFAULT NOTIFICATION SETTINGS
-- =============================================================================

-- Agent Notifications (9 types)
INSERT INTO notification_settings (role_type, setting_key, setting_label, setting_description, setting_icon, is_enabled, email_enabled, push_enabled, in_app_enabled) VALUES
('agent', 'new_ticket_assigned', 'New Ticket Assigned', 'When a new ticket is assigned to you', 'Ticket', true, true, true, true),
('agent', 'customer_reply', 'Customer Replied', 'When a customer replies to your ticket', 'MessageSquare', true, true, true, true),
('agent', 'ticket_escalated', 'Ticket Escalated', 'When a ticket is escalated to you', 'AlertTriangle', true, true, true, true),
('agent', 'mentioned_in_comment', 'Mentioned in Comment', 'When someone mentions you in a ticket comment', 'AtSign', true, false, true, true),
('agent', 'ticket_reassigned', 'Ticket Reassigned', 'When a ticket is reassigned from you', 'ArrowLeftRight', false, false, false, true),
('agent', 'sla_warning', 'SLA Warning', 'When a ticket is approaching SLA breach', 'Clock', true, true, true, true),
('agent', 'ticket_status_changed', 'Ticket Status Changed', 'When a ticket status is updated by customer or system', 'RefreshCw', true, false, false, true),
('agent', 'ticket_due_soon', 'Ticket Due Soon', 'Reminder when ticket deadline is approaching', 'Timer', true, true, true, true),
('agent', 'kb_article_update', 'Knowledge Base Update', 'When a KB article you follow is updated', 'BookOpen', false, false, false, true)
ON CONFLICT (role_type, setting_key) DO NOTHING;

-- Customer Notifications (7 types)
INSERT INTO notification_settings (role_type, setting_key, setting_label, setting_description, setting_icon, is_enabled, email_enabled, push_enabled, in_app_enabled) VALUES
('customer', 'ticket_created', 'Ticket Created Confirmation', 'Confirm when a new ticket is submitted', 'Ticket', true, true, false, true),
('customer', 'agent_replied', 'Agent Replied', 'When an agent replies to your ticket', 'MessageSquare', true, true, true, true),
('customer', 'ticket_status_update', 'Status Update', 'When ticket status changes (In Progress, On Hold, etc.)', 'RefreshCw', true, true, false, true),
('customer', 'ticket_resolved', 'Ticket Resolved', 'When your ticket is marked as resolved', 'CheckCircle', true, true, true, true),
('customer', 'ticket_closed', 'Ticket Closed', 'When your ticket is officially closed', 'Archive', false, true, false, true),
('customer', 'auto_close_warning', 'Auto-Close Warning', 'Warning before ticket is auto-closed due to inactivity', 'AlertTriangle', true, true, true, true),
('customer', 'satisfaction_survey', 'Satisfaction Survey', 'Send survey after ticket resolution', 'Star', true, true, false, false)
ON CONFLICT (role_type, setting_key) DO NOTHING;

-- Supervisor Notifications (9 types)
INSERT INTO notification_settings (role_type, setting_key, setting_label, setting_description, setting_icon, is_enabled, email_enabled, push_enabled, in_app_enabled) VALUES
('supervisor', 'sla_breach_warning', 'SLA Breach Warning', 'When tickets are approaching or have breached SLA', 'Clock', true, true, true, true),
('supervisor', 'escalation_triggered', 'Escalation Triggered', 'When an escalation rule is triggered', 'AlertTriangle', true, true, true, true),
('supervisor', 'daily_summary', 'Daily Summary Report', 'Daily summary of team performance', 'BarChart3', false, true, false, false),
('supervisor', 'weekly_report', 'Weekly Performance Report', 'Weekly report of team metrics', 'FileText', true, true, false, false),
('supervisor', 'critical_ticket', 'Critical Ticket Created', 'When a critical/urgent ticket is created', 'Flag', true, true, true, true),
('supervisor', 'agent_offline', 'Agent Offline Alert', 'When assigned agent goes offline with pending tickets', 'UserX', false, false, true, true),
('supervisor', 'unassigned_ticket_alert', 'Unassigned Ticket Alert', 'When a ticket remains unassigned for too long', 'UserMinus', true, true, true, true),
('supervisor', 'new_agent_joined', 'New Agent Joined Team', 'When a new agent is added to your team', 'UserPlus', false, true, false, true),
('supervisor', 'customer_complaint', 'Customer Complaint', 'When a ticket receives negative feedback or complaint', 'ThumbsDown', true, true, true, true)
ON CONFLICT (role_type, setting_key) DO NOTHING;


-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE auto_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_close_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for re-running script)
DROP POLICY IF EXISTS "Allow admins to manage auto assignment rules" ON auto_assignment_rules;
DROP POLICY IF EXISTS "Allow agents to view auto assignment rules" ON auto_assignment_rules;
DROP POLICY IF EXISTS "Allow admins to manage auto close rules" ON auto_close_rules;
DROP POLICY IF EXISTS "Allow agents to view auto close rules" ON auto_close_rules;
DROP POLICY IF EXISTS "Allow admins to manage notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Allow all users to view notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON user_notification_preferences;

-- Policies for auto_assignment_rules (Admin/Supervisor only can manage)
CREATE POLICY "Allow admins to manage auto assignment rules" ON auto_assignment_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id IN (1, 2) -- Admin and Supervisor
        )
    );

CREATE POLICY "Allow agents to view auto assignment rules" ON auto_assignment_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- Policies for auto_close_rules (Admin/Supervisor only can manage)
CREATE POLICY "Allow admins to manage auto close rules" ON auto_close_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id IN (1, 2)
        )
    );

CREATE POLICY "Allow agents to view auto close rules" ON auto_close_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- Policies for notification_settings (Admin only can manage, all can view)
CREATE POLICY "Allow admins to manage notification settings" ON notification_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id = 1
        )
    );

CREATE POLICY "Allow all users to view notification settings" ON notification_settings
    FOR SELECT USING (true);

-- Policies for user_notification_preferences (Users can manage their own)
CREATE POLICY "Users can manage their own notification preferences" ON user_notification_preferences
    FOR ALL USING (user_id = auth.uid());


-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_auto_assignment_rules_updated_at
    BEFORE UPDATE ON auto_assignment_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_close_rules_updated_at
    BEFORE UPDATE ON auto_close_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- SAMPLE DATA FOR AUTO ASSIGNMENT RULES
-- =============================================================================

INSERT INTO auto_assignment_rules (name, description, conditions, assign_to_type, assign_to_name, priority, is_active) VALUES
(
    'Network Issues',
    'Route network-related tickets to IT-Network team',
    '[{"field": "category", "operator": "equals", "value": "Network"}]'::jsonb,
    'group',
    'IT-Network Team',
    1,
    true
),
(
    'Finance Requests',
    'Route finance department requests to Finance Support',
    '[{"field": "department", "operator": "equals", "value": "Finance"}]'::jsonb,
    'group',
    'Finance Support',
    2,
    true
),
(
    'VIP Users Priority',
    'Priority handling for VIP users',
    '[{"field": "user_type", "operator": "equals", "value": "VIP"}]'::jsonb,
    'agent',
    'Senior Agent',
    0,
    true
),
(
    'Hardware Round Robin',
    'Distribute hardware tickets evenly across team',
    '[{"field": "category", "operator": "equals", "value": "Hardware"}]'::jsonb,
    'round_robin',
    'Hardware Team',
    3,
    false
);


-- =============================================================================
-- SAMPLE DATA FOR AUTO CLOSE RULES
-- =============================================================================

INSERT INTO auto_close_rules (name, description, condition_type, condition_value, after_days, after_hours, notify_user, notify_agent, add_note, note_text, is_active) VALUES
(
    'Pending Timeout',
    'Auto-close tickets that have been pending for too long',
    'status',
    'Pending',
    7,
    0,
    true,
    true,
    true,
    'Ticket auto-closed due to no response for 7 days.',
    true
),
(
    'Resolved Auto-Close',
    'Auto-close resolved tickets after confirmation period',
    'status',
    'Resolved',
    3,
    0,
    true,
    false,
    true,
    'Ticket auto-closed after 3 days in Resolved status.',
    true
),
(
    'User Confirmed Closure',
    'Immediately close when user confirms resolution',
    'user_confirmed',
    'true',
    0,
    1,
    false,
    true,
    true,
    'Ticket closed after user confirmation.',
    true
),
(
    'No Response Closure',
    'Close tickets with no customer response',
    'no_response',
    'customer',
    5,
    0,
    true,
    false,
    true,
    'Ticket auto-closed due to no customer response.',
    false
);


-- =============================================================================
-- DONE! 
-- =============================================================================

SELECT 'Automation tables created successfully!' AS status;
