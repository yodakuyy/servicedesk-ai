-- =====================================================
-- FIX: User Notification Preferences Table & RLS
-- Run this if save preferences is not working
-- =====================================================

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    
    -- Override values
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

-- 2. Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user 
    ON user_notification_preferences(user_id);

-- 3. Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can view own prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can insert own prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can update own prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can delete own prefs" ON user_notification_preferences;

-- 5. Create proper RLS policies (SEPARATE policies for each operation)
-- SELECT
CREATE POLICY "Users can view own prefs" 
ON user_notification_preferences
FOR SELECT 
USING (user_id = auth.uid());

-- INSERT
CREATE POLICY "Users can insert own prefs" 
ON user_notification_preferences
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- UPDATE
CREATE POLICY "Users can update own prefs" 
ON user_notification_preferences
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE
CREATE POLICY "Users can delete own prefs" 
ON user_notification_preferences
FOR DELETE 
USING (user_id = auth.uid());

-- 6. Grant permissions
GRANT ALL ON user_notification_preferences TO authenticated;
GRANT ALL ON user_notification_preferences TO service_role;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'User Notification Preferences table fixed!' as status;

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'user_notification_preferences';
