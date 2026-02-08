-- =====================================================
-- ENHANCED NOTIFICATION SYSTEM
-- =====================================================
-- Update send_notification() to respect user preferences
-- =====================================================

-- 1. Create helper function to check if notification should be sent
CREATE OR REPLACE FUNCTION should_send_notification(
    p_user_id UUID,
    p_notification_type TEXT, -- Maps to setting_key like 'new_ticket_assigned', 'ticket_reply', etc.
    p_channel TEXT DEFAULT 'in_app' -- 'email', 'push', 'in_app'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_role_type TEXT;
    v_global_enabled BOOLEAN;
    v_channel_enabled BOOLEAN;
    v_user_override_enabled BOOLEAN;
    v_user_channel_override BOOLEAN;
BEGIN
    -- Get user's role
    SELECT 
        CASE 
            WHEN r.role_name ILIKE '%admin%' OR r.role_name ILIKE '%supervisor%' THEN 'supervisor'
            WHEN r.role_name ILIKE '%agent%' THEN 'agent'
            ELSE 'customer'
        END INTO v_role_type
    FROM profiles p
    LEFT JOIN roles r ON p.role_id = r.id
    WHERE p.id = p_user_id;

    -- Default to customer if role not found
    v_role_type := COALESCE(v_role_type, 'customer');

    -- Check global notification settings for this role and type
    SELECT 
        COALESCE(is_enabled, true),
        CASE p_channel
            WHEN 'email' THEN COALESCE(email_enabled, true)
            WHEN 'push' THEN COALESCE(push_enabled, false)
            ELSE COALESCE(in_app_enabled, true)
        END
    INTO v_global_enabled, v_channel_enabled
    FROM notification_settings
    WHERE role_type = v_role_type
      AND setting_key = p_notification_type
    LIMIT 1;

    -- If no global setting found, default to enabled
    IF v_global_enabled IS NULL THEN
        v_global_enabled := true;
        v_channel_enabled := true;
    END IF;

    -- Check if global setting is disabled
    IF NOT v_global_enabled THEN
        RETURN false;
    END IF;

    -- Check user-level override
    SELECT 
        is_enabled,
        CASE p_channel
            WHEN 'email' THEN email_enabled
            WHEN 'push' THEN push_enabled
            ELSE in_app_enabled
        END
    INTO v_user_override_enabled, v_user_channel_override
    FROM user_notification_preferences
    WHERE user_id = p_user_id
      AND setting_key = p_notification_type
    LIMIT 1;

    -- Apply user override if exists
    IF v_user_override_enabled IS NOT NULL AND NOT v_user_override_enabled THEN
        RETURN false;
    END IF;

    IF v_user_channel_override IS NOT NULL THEN
        RETURN v_user_channel_override;
    END IF;

    -- Return global channel setting
    RETURN v_channel_enabled;
END;
$$;

-- 2. Create enhanced send_notification that respects preferences
CREATE OR REPLACE FUNCTION send_notification_v2(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'info',
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_setting_key TEXT DEFAULT NULL -- Explicit setting key for preference check
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notification_id UUID;
    v_should_send BOOLEAN;
    v_setting_key TEXT;
BEGIN
    -- Determine setting key from notification type or explicit param
    v_setting_key := COALESCE(p_setting_key, 
        CASE p_type
            WHEN 'ticket_assigned' THEN 'new_ticket_assigned'
            WHEN 'ticket_reply' THEN CASE 
                WHEN p_title ILIKE '%agent%' THEN 'agent_replied'
                ELSE 'customer_reply'
            END
            WHEN 'ticket_closed' THEN 'ticket_closed'
            WHEN 'ticket_resolved' THEN 'ticket_resolved'
            WHEN 'sla_warning' THEN 'sla_warning'
            WHEN 'escalation' THEN 'escalation_triggered'
            WHEN 'ticket_status_changed' THEN 'ticket_status_update'
            WHEN 'auto_close_warning' THEN 'auto_close_warning'
            ELSE 'general'
        END
    );

    -- Check if in-app notification should be sent
    v_should_send := should_send_notification(p_user_id, v_setting_key, 'in_app');

    IF NOT v_should_send THEN
        -- User has disabled this notification type
        RAISE NOTICE 'Notification skipped for user % (setting: %, type: %)', p_user_id, v_setting_key, p_type;
        RETURN NULL;
    END IF;

    -- Insert notification
    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (p_user_id, p_title, p_message, p_type, p_reference_type, p_reference_id)
    RETURNING id INTO v_notification_id;

    -- =========================================================================
    -- EMAIL INTEGRATION (Check 'http' extension)
    -- =========================================================================
    -- Requires: create extension if not exists http;
    -- AND notification setting check for 'email' channel
    -- 
    -- IF v_email_enabled AND (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    --     PERFORM net.http_post(
    --         url := 'https://api.resend.com/emails',
    --         headers := '{"Authorization": "Bearer YOUR_RESEND_API_KEY", "Content-Type": "application/json"}'::jsonb,
    --         body := jsonb_build_object(
    --             'from', 'Servicedesk <onboarding@resend.dev>',
    --             'to', (SELECT email FROM auth.users WHERE id = p_user_id),
    --             'subject', p_title,
    --             'html', '<p>' || p_message || '</p>'
    --         )
    --     );
    -- END IF;
    -- =========================================================================

    RETURN v_notification_id;
END;
$$;

-- 3. Update existing send_notification to use preferences
CREATE OR REPLACE FUNCTION send_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'info',
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delegate to v2 function with auto-detected setting key
    RETURN send_notification_v2(
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_reference_type,
        p_reference_id,
        NULL -- Auto-detect setting key
    );
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION should_send_notification(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION should_send_notification(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION send_notification_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_notification_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION send_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- =====================================================
-- 5. RPC function for frontend to get user preferences
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_notification_settings()
RETURNS TABLE(
    setting_key TEXT,
    setting_label TEXT,
    setting_description TEXT,
    is_enabled BOOLEAN,
    email_enabled BOOLEAN,
    push_enabled BOOLEAN,
    in_app_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_type TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Determine user's role type
    SELECT 
        CASE 
            WHEN r.role_name ILIKE '%admin%' OR r.role_name ILIKE '%supervisor%' THEN 'supervisor'
            WHEN r.role_name ILIKE '%agent%' THEN 'agent'
            ELSE 'customer'
        END INTO v_role_type
    FROM profiles p
    LEFT JOIN roles r ON p.role_id = r.id
    WHERE p.id = v_user_id;

    v_role_type := COALESCE(v_role_type, 'customer');

    -- Return merged settings (global + user override)
    RETURN QUERY
    SELECT 
        ns.setting_key,
        ns.setting_label,
        ns.setting_description,
        COALESCE(unp.is_enabled, ns.is_enabled) as is_enabled,
        COALESCE(unp.email_enabled, ns.email_enabled) as email_enabled,
        COALESCE(unp.push_enabled, ns.push_enabled) as push_enabled,
        COALESCE(unp.in_app_enabled, ns.in_app_enabled) as in_app_enabled
    FROM notification_settings ns
    LEFT JOIN user_notification_preferences unp 
        ON unp.user_id = v_user_id AND unp.setting_key = ns.setting_key
    WHERE ns.role_type = v_role_type
    ORDER BY ns.setting_key;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_notification_settings() TO authenticated;

-- =====================================================
-- 6. RPC function to update user preferences
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_notification_preference(
    p_setting_key TEXT,
    p_is_enabled BOOLEAN DEFAULT NULL,
    p_email_enabled BOOLEAN DEFAULT NULL,
    p_push_enabled BOOLEAN DEFAULT NULL,
    p_in_app_enabled BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Upsert user preference
    INSERT INTO user_notification_preferences (
        user_id, setting_key, is_enabled, email_enabled, push_enabled, in_app_enabled
    )
    VALUES (
        v_user_id, p_setting_key, p_is_enabled, p_email_enabled, p_push_enabled, p_in_app_enabled
    )
    ON CONFLICT (user_id, setting_key) 
    DO UPDATE SET
        is_enabled = COALESCE(p_is_enabled, user_notification_preferences.is_enabled),
        email_enabled = COALESCE(p_email_enabled, user_notification_preferences.email_enabled),
        push_enabled = COALESCE(p_push_enabled, user_notification_preferences.push_enabled),
        in_app_enabled = COALESCE(p_in_app_enabled, user_notification_preferences.in_app_enabled),
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'success', true,
        'setting_key', p_setting_key,
        'updated_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_notification_preference(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Enhanced Notification System installed!' as status;

-- Test the should_send function (replace with actual user_id)
-- SELECT should_send_notification('user-uuid-here', 'new_ticket_assigned', 'in_app');
