-- ============================================
-- FIX PERMISSIONS untuk user_groups dan groups
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- Masalah: "permission denied for table user_groups"
-- ============================================

BEGIN;

-- 1. Disable RLS untuk tabel groups dan user_groups
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups DISABLE ROW LEVEL SECURITY;

-- 2. Grant permissions ke semua roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant untuk groups table
GRANT ALL ON TABLE public.groups TO anon, authenticated, service_role;

-- Grant untuk user_groups table
GRANT ALL ON TABLE public.user_groups TO anon, authenticated, service_role;

-- 3. Grant permissions untuk sequences (jika ada auto-increment)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

-- Verifikasi
SELECT 'Groups table:' as check_table;
SELECT * FROM public.groups LIMIT 5;

SELECT 'User Groups table:' as check_table;
SELECT * FROM public.user_groups LIMIT 5;
