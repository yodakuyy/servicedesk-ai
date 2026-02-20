-- ============================================
-- FIX RLS untuk Tabel Company
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================

-- Option 1: Disable RLS (Paling Mudah - untuk development)
ALTER TABLE public.company DISABLE ROW LEVEL SECURITY;

-- Option 2: Enable RLS dengan Policy Public Access (Lebih Aman)
-- Uncomment baris di bawah jika ingin pakai option 2
-- ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Allow public read access to company" ON public.company;
-- 
-- CREATE POLICY "Allow public read access to company"
-- ON public.company
-- FOR SELECT
-- TO public
-- USING (true);

-- Verify: Check apakah data bisa diakses
SELECT * FROM public.company;
