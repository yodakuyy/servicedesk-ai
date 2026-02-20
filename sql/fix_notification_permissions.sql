-- Update RLS Policy for notification_settings to allow both Admins (1) and Supervisors (2)
DROP POLICY IF EXISTS "Allow admins to manage notification settings" ON notification_settings;

CREATE POLICY "Allow management for admins and supervisors" ON notification_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id IN (1, 2)
        )
    );

-- Grant permissions to authenticated users just in case
GRANT ALL ON TABLE notification_settings TO authenticated;
GRANT ALL ON TABLE notification_settings TO service_role;

SELECT 'Security policy updated: Admins and Supervisors can now manage notifications' AS status;
