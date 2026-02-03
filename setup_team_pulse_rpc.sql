-- FUNCTION: get_team_pulse (VERSI FINAL ROBUST)
-- Menampilkan rekan satu tim dengan perhitungan tiket yang akurat (Bypass RLS)

-- 1. Bersihkan fungsi lama agar tidak bentrok signature
DROP FUNCTION IF EXISTS public.get_team_pulse();
DROP FUNCTION IF EXISTS public.get_team_pulse(uuid);

-- 2. Buat fungsi baru
CREATE OR REPLACE FUNCTION public.get_team_pulse()
RETURNS TABLE (
  agent_id uuid,
  full_name text,
  email text,
  role_id int,
  active_count bigint,
  resolved_today_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS untuk perhitungan agregat
SET search_path = public
AS $$
DECLARE
    v_viewer_id uuid;
BEGIN
  v_viewer_id := auth.uid(); -- Ambil ID user dari JWT

  RETURN QUERY
  SELECT 
    p.id as agent_id,
    p.full_name,
    p.email,
    p.role_id,
    -- Hitung Tiket Active (Open, In Progress, Pending)
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_agent_id = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.status_name IN ('Open', 'In Progress', 'Pending')
     ))::bigint as active_count,
    -- Hitung Tiket Resolved Hari Ini
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_agent_id = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE s.status_name IN ('Resolved', 'Closed')
     )
     AND t.updated_at::date = CURRENT_DATE)::bigint as resolved_today_count
  FROM public.profiles p
  WHERE p.role_id IN (2, 3) -- Ambil SPV (2) dan Agent (3)
  AND (
    -- FALLBACK: Jika viewer tidak punya grup, tampilkan semua agent
    v_viewer_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.user_groups WHERE user_id = v_viewer_id)
    OR
    -- FILTER: Tampilkan hanya yang satu grup dengan viewer
    p.id IN (
      SELECT ug2.user_id 
      FROM public.user_groups ug2
      JOIN public.user_groups ug1 ON ug1.group_id = ug2.group_id
      WHERE ug1.user_id = v_viewer_id
    )
  )
  ORDER BY 
    CASE WHEN p.role_id = 2 THEN 0 ELSE 1 END ASC, -- SPV Selalu Paling Atas
    5 DESC; -- Diikuti oleh yang paling banyak tiket aktifnya
END;
$$;

-- 3. Berikan izin akses yang luas untuk debugging
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO service_role;
