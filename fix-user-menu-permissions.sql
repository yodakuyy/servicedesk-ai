-- ================================================
-- FIX: user_menu_permissions table access
-- Run this SQL in Supabase SQL Editor
-- ================================================

-- 1. Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'user_menu_permissions'
);

-- 2. If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_update BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, menu_id)
);

-- 3. Disable RLS (Row Level Security) to allow access
ALTER TABLE public.user_menu_permissions DISABLE ROW LEVEL SECURITY;

-- 4. Grant permissions to all roles
GRANT ALL ON TABLE public.user_menu_permissions TO anon;
GRANT ALL ON TABLE public.user_menu_permissions TO authenticated;
GRANT ALL ON TABLE public.user_menu_permissions TO service_role;

-- 5. Verify table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_menu_permissions'
ORDER BY ordinal_position;

-- 6. Check existing data
SELECT * FROM public.user_menu_permissions LIMIT 10;

-- ================================================
-- OPTIONAL: If you need to see what's in the table for a specific user
-- Replace 'USER_ID_HERE' with actual user ID
-- ================================================
-- SELECT 
--     ump.*,
--     m.label as menu_name
-- FROM public.user_menu_permissions ump
-- LEFT JOIN public.menus m ON m.id = ump.menu_id
-- WHERE ump.user_id = 'USER_ID_HERE';
