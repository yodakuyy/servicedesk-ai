-- ==============================================================================
-- IMPLEMENTASI ROUND ROBIN TICKET ASSIGNMENT (VERSION 3 - FINAL ROLE FILTER)
-- ==============================================================================

-- 1. Fungsi untuk mencari Agent berikutnya dalam sebuah grup (Round Robin)
CREATE OR REPLACE FUNCTION public.get_next_agent_for_group(target_group_id UUID)
RETURNS UUID AS $$
DECLARE
    next_agent_id UUID;
BEGIN
    -- Logika Round Robin:
    -- 1. Cari user di grup tersebut.
    -- 2. FILTER KETAT: Hanya 'Agent L1' dan 'Agent Supervisor' yang dapat tiket otomatis.
    -- 3. EXCLUDE: 'Administrator', 'Agent L2', dan 'Requester' diabaikan dalam Round Robin.
    -- 4. Pilih yang paling lama tidak menerima tiket (least recently assigned).
    
    SELECT ug.user_id INTO next_agent_id
    FROM public.user_groups ug
    JOIN public.profiles p ON ug.user_id = p.id
    JOIN public.roles r ON p.role_id = r.role_id
    LEFT JOIN (
        -- Ambil waktu assignment terakhir untuk setiap agent di grup ini
        SELECT assigned_to, MAX(created_at) as last_assigned
        FROM public.tickets
        WHERE assignment_group_id = target_group_id
        GROUP BY assigned_to
    ) t ON ug.user_id = t.assigned_to
    WHERE ug.group_id = target_group_id
    AND r.role_name IN ('Agent L1', 'Agent Supervisor') -- HANYA role ini yang masuk putaran
    ORDER BY t.last_assigned NULLS FIRST, p.full_name ASC
    LIMIT 1;

    RETURN next_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger Function untuk otomatis mengisi assigned_to saat tiket dibuat
CREATE OR REPLACE FUNCTION public.tr_func_auto_assign_pic()
RETURNS TRIGGER AS $$
BEGIN
    -- Jalankan hanya jika assignment_group_id terisi tapi assigned_to masih kosong
    IF NEW.assignment_group_id IS NOT NULL AND NEW.assigned_to IS NULL THEN
        NEW.assigned_to := public.get_next_agent_for_group(NEW.assignment_group_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pasang Trigger ke tabel tickets
DROP TRIGGER IF EXISTS tr_auto_assign_pic ON public.tickets;
CREATE TRIGGER tr_auto_assign_pic
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tr_func_auto_assign_pic();

-- 4. Berikan izin eksekusi fungsi
GRANT EXECUTE ON FUNCTION public.get_next_agent_for_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tr_func_auto_assign_pic() TO authenticated;

-- KONFIRMASI: Administrator dan Agent L2 sekarang RESMI dikecualikan dari antrian otomatis.
