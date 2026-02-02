-- =====================================================
-- DAILY NOTIFICATION RESET SYSTEM
-- =====================================================
-- This script creates a system to reset "read" notifications daily
-- Only notifications that were read the PREVIOUS day will be reset
-- Notifications that are still UNREAD are preserved
-- =====================================================

-- 1. Create a function to reset read notifications daily
-- This function will:
-- - Reset is_read to FALSE for notifications that were read_at on a previous day
-- - Preserve unread notifications (is_read = FALSE)
-- - Clear read_at timestamp when resetting
CREATE OR REPLACE FUNCTION reset_daily_read_notifications()
RETURNS void AS $$
BEGIN
    -- Reset notifications that were read on a previous day (not today)
    -- Only affect notifications where is_read = true AND read_at is from a previous day
    UPDATE notifications
    SET 
        is_read = FALSE,
        read_at = NULL
    WHERE 
        is_read = TRUE 
        AND read_at IS NOT NULL
        AND read_at::date < CURRENT_DATE;  -- Only reset if read on a previous day
    
    -- Log the action (optional - for debugging)
    RAISE NOTICE 'Daily notification reset completed at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION reset_daily_read_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_daily_read_notifications() TO service_role;

-- 3. Create a scheduled job using pg_cron (if available in your Supabase plan)
-- NOTE: pg_cron is only available on Pro plan and above
-- This will run at 00:01 every day

-- First, enable pg_cron extension (requires superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Then schedule the job to run at 00:01 (12:01 AM) every day
-- SELECT cron.schedule(
--     'daily-notification-reset',  -- job name
--     '1 0 * * *',                  -- cron expression: at 00:01 every day
--     'SELECT reset_daily_read_notifications()'
-- );

-- =====================================================
-- ALTERNATIVE: For Supabase Free Tier (without pg_cron)
-- =====================================================
-- You can call this function from your application on app startup
-- or set up an external cron job (e.g., using Vercel Cron, GitHub Actions, etc.)

-- Example: Called from frontend on app initialization (in useNotifications.ts)
-- Add this RPC call in your app:
-- await supabase.rpc('reset_daily_read_notifications');


-- =====================================================
-- 4. Create an index for faster daily reset queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notifications_read_at_date 
ON notifications(read_at) 
WHERE is_read = TRUE;


-- =====================================================
-- TESTING THE FUNCTION
-- =====================================================
-- To test, you can run:
-- SELECT reset_daily_read_notifications();

-- To see which notifications would be reset (without actually resetting):
-- SELECT id, user_id, title, is_read, read_at
-- FROM notifications
-- WHERE is_read = TRUE 
--   AND read_at IS NOT NULL
--   AND read_at::date < CURRENT_DATE;


-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================
-- DROP FUNCTION IF EXISTS reset_daily_read_notifications();
-- DROP INDEX IF EXISTS idx_notifications_read_at_date;
