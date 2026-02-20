-- =================================================================
-- FIX PERMISSIONS FOR ALL TABLES (SOLUSI KOMPLIT)
-- =================================================================
-- Jalankan script ini di Supabase SQL Editor.
-- Script ini akan memperbaiki "Permission denied" untuk tabel company, roles, dll.
-- =================================================================

BEGIN;

-- 1. Matikan RLS untuk semua tabel terkait
ALTER TABLE public.company DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menu_permissions DISABLE ROW LEVEL SECURITY;
-- Ulangi profiles (hanya untuk memastikan)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Berikan permission ke Public, Anon, dan Authenticated
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant untuk Company
GRANT ALL ON TABLE public.company TO anon, authenticated, service_role;
-- Grant untuk Roles
GRANT ALL ON TABLE public.roles TO anon, authenticated, service_role;
-- Grant untuk Menus
GRANT ALL ON TABLE public.menus TO anon, authenticated, service_role;
-- Grant untuk Role Permissions
GRANT ALL ON TABLE public.role_menu_permissions TO anon, authenticated, service_role;
-- Grant untuk Profiles
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

-- 3. Berikan permission untuk sequence (auto-increment)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

-- Verifikasi dengan select company
SELECT * FROM public.company LIMIT 5;
