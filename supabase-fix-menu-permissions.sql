-- ============================================
-- FIX PERMISSIONS untuk menus dan menu permissions tables
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- Masalah: "permission denied for table user_menu_permissions"
-- ============================================

BEGIN;

-- 1. Disable RLS untuk tabel menus dan menu permissions
ALTER TABLE public.menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menu_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions DISABLE ROW LEVEL SECURITY;

-- 2. Grant permissions ke semua roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant untuk menus table
GRANT ALL ON TABLE public.menus TO anon, authenticated, service_role;

-- Grant untuk role_menu_permissions table
GRANT ALL ON TABLE public.role_menu_permissions TO anon, authenticated, service_role;

-- Grant untuk user_menu_permissions table
GRANT ALL ON TABLE public.user_menu_permissions TO anon, authenticated, service_role;

-- 3. Grant permissions untuk sequences (jika ada auto-increment)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

-- Verifikasi
SELECT 'Menus table:' as check_table;
SELECT * FROM public.menus LIMIT 5;

SELECT 'Role Menu Permissions table:' as check_table;
SELECT * FROM public.role_menu_permissions LIMIT 5;

SELECT 'User Menu Permissions table:' as check_table;
SELECT * FROM public.user_menu_permissions LIMIT 5;
