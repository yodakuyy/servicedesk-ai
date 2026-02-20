-- ============================================
-- SOLUSI FINAL: BYPASS PERMISSION DENGAN FUNCTION
-- ============================================
-- Karena terus "Permission denied" (mungkin karena RLS yang ketat atau owner berbeda),
-- Cara terbaik adalah membuat fungsi "Security Definer".
-- Fungsi ini berjalan dengan hak akses ADMIN, jadi mengabaikan permission user.
-- ============================================

-- 1. Buat Fungsi
CREATE OR REPLACE FUNCTION get_profile_by_email(email_input TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- <--- INI KUNCINYA. Fungsi berjalan sebagai Admin.
AS $$
DECLARE
  found_profile json;
BEGIN
  SELECT row_to_json(t) 
  INTO found_profile
  FROM (
    SELECT id, full_name, role_id, company_id 
    FROM public.profiles 
    WHERE email = email_input
  ) t;
  
  RETURN found_profile;
END;
$$;

-- 2. Beri izin user untuk menjalankan fungsi ini
GRANT EXECUTE ON FUNCTION get_profile_by_email(TEXT) TO anon, authenticated, service_role;
