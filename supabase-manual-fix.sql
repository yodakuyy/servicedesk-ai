-- =================================================================
-- MASTER FIX PERMISSIONS (SOLUSI PUNGKAS UNTUK PERMISSION DENIED)
-- =================================================================
-- Jalankan SELURUH script ini di Supabase SQL Editor.
-- Script ini akan:
-- 1. Mematikan RLS pada tabel profiles (agar bisa dibaca publik/app)
-- 2. Memberikan hak akses penuh ke role 'anon' dan 'authenticated'
-- 3. Memastikan sequence (auto-increment) juga bisa diakses
-- =================================================================

BEGIN;

-- 1. Matikan RLS untuk profiles
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Berikan permission ke Public, Anon, dan Authenticated
--    Ini memastikan tidak ada alasan "Permission Denied" muncul lagi.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- 3. Berikan permission juga untuk sequence (jika id profile auto-generated)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

-- Verifikasi dengan select
SELECT count(*) as total_profiles FROM public.profiles;
