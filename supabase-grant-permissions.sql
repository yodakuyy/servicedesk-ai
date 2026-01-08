-- ============================================
-- FIX TOTAL PERMISSION (RLS + GRANTS)
-- ============================================
-- Jalankan SCIPT INI di Supabase SQL Editor
-- Masalah "Permission denied" bisa dari RLS atau dari Basic Table Permissions (GRANT)
-- Script ini memperbaiki keduanya.
-- ============================================

-- 1. Pastikan RLS Mati (untuk debugging development)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Pastikan permission SELECT diberikan ke role yang dipakai Supabase
-- 'authenticated': user yang sudah login
-- 'anon': user belum login (kadang request pertama terdeteksi sbg anon jika session belum fully set)
-- 'service_role': admin (biasanya sudah punya akses penuh)

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- 3. (Opsional) Jika profiles punya kolom ID yang auto-increment (serial/sequence)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Cek apakah ada policy yang "nyangkut" (jika RLS nanti dinyalakan lagi)
-- DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;
-- CREATE POLICY "Public profiles access" ON public.profiles FOR SELECT USING (true);
