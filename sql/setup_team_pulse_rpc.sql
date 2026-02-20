-- FUNCTION: get_team_pulse (VERSI PERBAIKAN TYPE MISMATCH)
-- Memperbaiki error 42804 (Structure of query does not match function result)
-- Dengan menambahkan explicit casting ::TEXT pada kolom string

-- 1. Bersihkan fungsi lama
DROP FUNCTION IF EXISTS public.get_team_pulse();

-- 2. Buat fungsi baru dengan casting yang tepat
CREATE OR REPLACE FUNCTION public.get_team_pulse()
RETURNS TABLE (
  agent_id uuid,
  full_name text,
  email text,
  role_id int,
  active_count bigint,
  resolved_today_count bigint,
  overdue_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_viewer_id uuid;
    v_viewer_role int;
BEGIN
  v_viewer_id := auth.uid();
  
  -- Ambil role penglihat
  SELECT p.role_id INTO v_viewer_role FROM public.profiles p WHERE p.id = v_viewer_id;

  RETURN QUERY
  SELECT 
    p.id as agent_id,
    p.full_name::TEXT, -- Tambahkan casting ::TEXT untuk menghindari mismatch VARCHAR
    p.email::TEXT,     -- Tambahkan casting ::TEXT
    p.role_id::INT,
    -- Hitung Tiket Active
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.status_name IN ('Open', 'In Progress') 
            OR s.status_name ILIKE '%Pending%'
     ))::bigint as active_count,
    -- Hitung Tiket Resolved Hari Ini
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.status_name IN ('Resolved', 'Closed')
     )
     AND t.updated_at::date = CURRENT_DATE)::bigint as resolved_today_count,
    -- Hitung Tiket Overdue (> 24 jam)
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.status_name NOT IN ('Resolved', 'Closed', 'Canceled')
     )
     AND t.created_at < (NOW() - INTERVAL '24 hours'))::bigint as overdue_count
  FROM public.profiles p
  WHERE p.role_id IN (2, 3) -- Tampilkan hanya SPV (2) dan Agent (3)
  AND (
    v_viewer_role = 1 -- Jika Admin (1), tampilkan SEMUA tanpa filter grup
    OR NOT EXISTS (SELECT 1 FROM public.user_groups WHERE user_id = v_viewer_id)
    OR p.id IN (
      -- Tampilkan rekan satu grup
      SELECT ug2.user_id FROM public.user_groups ug2
      JOIN public.user_groups ug1 ON ug1.group_id = ug2.group_id
      WHERE ug1.user_id = v_viewer_id
    )
  )
  ORDER BY 
    CASE WHEN p.role_id = 2 THEN 0 ELSE 1 END ASC, -- SPV Selalu Paling Atas
    active_count DESC;
END;
$$;

-- 3. Berikan izin akses
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO service_role;
