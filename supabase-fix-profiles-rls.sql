-- ============================================
-- FIX RLS untuk Tabel Profiles
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- untuk mengatasi error "permission denied for table profiles"
-- ============================================

-- Option 1: Disable RLS (Paling Mudah - untuk development)
-- Ini mematikan security policy, jadi siapa saja (yang punya API key) bisa baca/tulis
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Option 2: Enable RLS dengan Policy yang Benar (Lebih Aman)
-- Jika ingin tetap menyalakan RLS, gunakan policy di bawah ini:

/*
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Policy untuk melihat profile sendiri (atau semua profile jika diperlukan untuk fitur User Management)
-- Disini kita buat agar authenticated user bisa melihat SEMUA profile (agar bisa saling cari/lihat di fitur management)
CREATE POLICY "Allow authenticated users to read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Policy untuk update profile sendiri
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 3. Policy untuk insert (biasanya handled by trigger, tapi jika manual)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
*/

-- Verifikasi hasil
SELECT * FROM public.profiles LIMIT 5;
