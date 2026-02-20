-- =====================================================
-- WORKFLOW & SLA SINKRONISASI (L1 & L2 CONCEPT)
-- =====================================================
-- 1. Perbarui Master Status & SLA Behavior
-- 2. Tambahkan Kolom Pelacakan SLA Paused di Tabel Tiket
-- 3. Trigger otomatis untuk Pause/Resume jam SLA
-- 4. Perbarui Kalkulasi Eskalasi agar menghargai waktu Paused
-- =====================================================

BEGIN;

-- 1. UPDATE TICKET STATUSES & BEHAVIOR
-- Menggunakan DO block agar lebih fleksibel dibanding ON CONFLICT yang butuh unique constraint
DO $$ 
DECLARE 
    status_rec RECORD;
    target_statuses JSONB := '[
        {"name": "New", "code": "NEW", "behavior": "run", "cat": "system", "final": false},
        {"name": "Open", "code": "OPEN", "behavior": "run", "cat": "agent", "final": false},
        {"name": "In Progress", "code": "IN_PROGRESS", "behavior": "run", "cat": "agent", "final": false},
        {"name": "Escalated", "code": "ESCALATED", "behavior": "run", "cat": "agent", "final": false},
        {"name": "Pending - Waiting For Requester", "code": "PENDING_USER", "behavior": "pause", "cat": "agent", "final": false},
        {"name": "Pending - Development", "code": "PENDING_DEV", "behavior": "pause", "cat": "agent", "final": false},
        {"name": "Resolved", "code": "RESOLVED", "behavior": "stop", "cat": "agent", "final": false},
        {"name": "Canceled", "code": "CANCELED", "behavior": "stop", "cat": "agent", "final": true},
        {"name": "Closed", "code": "CLOSED", "behavior": "stop", "cat": "system", "final": true}
    ]'::jsonb;
    s JSONB;
BEGIN
    FOR s IN SELECT * FROM jsonb_array_elements(target_statuses) LOOP
        -- Cari apakah sudah ada status dengan nama ini
        IF EXISTS (SELECT 1 FROM public.ticket_statuses WHERE status_name = s->>'name') THEN
            UPDATE public.ticket_statuses 
            SET sla_behavior = (s->>'behavior')::sla_behavior_enum,
                status_code = s->>'code',
                status_category = (s->>'cat')::status_category_enum,
                is_final = (s->>'final')::boolean
            WHERE status_name = s->>'name';
        ELSE
            INSERT INTO public.ticket_statuses (status_name, status_code, sla_behavior, status_category, is_final, is_active)
            VALUES (
                s->>'name', 
                s->>'code', 
                (s->>'behavior')::sla_behavior_enum, 
                (s->>'cat')::status_category_enum, 
                (s->>'final')::boolean, 
                true
            );
        END IF;
    END LOOP;
END $$;

-- 2. UPDATE TICKETS SCHEMA
-- Menambahkan kolom untuk melacak waktu jeda (Paused)
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_paused_minutes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

-- 3. TRIGGER UNTUK PAUSE/RESUME SLA SECARA OTOMATIS
CREATE OR REPLACE FUNCTION handle_ticket_sla_tracking()
RETURNS TRIGGER AS $$
DECLARE
    v_old_behavior TEXT;
    v_new_behavior TEXT;
    v_schedule JSONB;
    v_paused_minutes INT;
BEGIN
    -- Ambil behavior SLA dari status lama dan baru
    SELECT sla_behavior INTO v_old_behavior FROM ticket_statuses WHERE status_id = OLD.status_id;
    SELECT sla_behavior INTO v_new_behavior FROM ticket_statuses WHERE status_id = NEW.status_id;

    -- JIKA PINDAH KE STATUS PAUSE
    IF v_new_behavior = 'pause' AND (v_old_behavior IS NULL OR v_old_behavior != 'pause') THEN
        NEW.paused_at := NOW();
    END IF;

    -- JIKA PINDAH DARI STATUS PAUSE KE RUN/STOP
    IF v_old_behavior = 'pause' AND v_new_behavior != 'pause' AND OLD.paused_at IS NOT NULL THEN
        -- Ambil jadwal kerja dari grup
        SELECT bh.weekly_schedule INTO v_schedule 
        FROM groups g 
        JOIN business_hours bh ON g.business_hour_id = bh.id
        WHERE g.id = NEW.assignment_group_id;

        -- Hitung berapa menit dalam jam kerja yang terbuang saat status paused
        v_paused_minutes := calculate_business_minutes_sql(OLD.paused_at, NOW(), v_schedule);
        
        NEW.total_paused_minutes := COALESCE(OLD.total_paused_minutes, 0) + v_paused_minutes;
        NEW.paused_at := NULL;
    END IF;

    -- JIKA STATUS ADALAH ESCALATED, CATAT WAKTUNYA
    IF v_new_behavior = 'run' AND NEW.status_id IN (SELECT status_id FROM ticket_statuses WHERE status_name = 'Escalated') THEN
        NEW.last_escalated_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_sla_tracking ON tickets;
CREATE TRIGGER trg_ticket_sla_tracking
    BEFORE UPDATE OF status_id ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION handle_ticket_sla_tracking();

-- 4. UPDATE KALKULASI ESKALASI (SLA PERCENTAGE)
-- Modifikasi fungsi agar mengurangi total_paused_minutes dari waktu pengerjaan
CREATE OR REPLACE FUNCTION check_sla_percentage_escalations()
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_escalation RECORD;
    v_supervisor_id UUID;
    v_target RECORD;
    v_sla_target_minutes INTEGER;
    v_elapsed_minutes NUMERIC;
    v_current_pause_minutes NUMERIC;
    v_percentage_used NUMERIC;
    v_schedule JSONB;
    v_processed_count INTEGER := 0;
    v_notification_count INTEGER := 0;
    v_log TEXT := '';
BEGIN
    FOR v_ticket IN
        SELECT 
            t.id, t.ticket_number, t.subject, t.priority, t.assigned_to, t.assignment_group_id,
            t.created_at, t.updated_at, t.first_response_at, t.paused_at, t.total_paused_minutes,
            p.full_name as agent_name, ts.status_name, ts.sla_behavior,
            g.name as group_name, g.business_hour_id, g.sla_policy_id as group_sla_policy_id,
            bh.weekly_schedule
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_to = p.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN groups g ON t.assignment_group_id = g.id
        LEFT JOIN business_hours bh ON g.business_hour_id = bh.id
        WHERE ts.sla_behavior != 'stop' -- Jangan hitung tiket yang sudah Resolved/Closed/Canceled
          AND t.assignment_group_id IS NOT NULL
    LOOP
        v_processed_count := v_processed_count + 1;
        v_schedule := v_ticket.weekly_schedule;

        -- 1. Hitung total waktu berjalan (Business Minutes)
        v_elapsed_minutes := calculate_business_minutes_sql(v_ticket.created_at, NOW(), v_schedule);
        
        -- 2. Kurangi waktu Paused yang sudah tercatat permanen
        v_elapsed_minutes := v_elapsed_minutes - COALESCE(v_ticket.total_paused_minutes, 0);

        -- 3. JIKA SEDANG PAUSED SEKARANG, kurangi waktu berjalan sejak pause dimulai
        IF v_ticket.paused_at IS NOT NULL THEN
            v_current_pause_minutes := calculate_business_minutes_sql(v_ticket.paused_at, NOW(), v_schedule);
            v_elapsed_minutes := v_elapsed_minutes - v_current_pause_minutes;
        END IF;

        -- JAMINAN TIDAK NEGATIF
        v_elapsed_minutes := GREATEST(0, v_elapsed_minutes);

        -- CHECK RESPONSE SLA
        IF v_ticket.first_response_at IS NULL AND v_ticket.group_sla_policy_id IS NOT NULL THEN
            SELECT * INTO v_target FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id AND sla_type = 'response'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT) LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 60);
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE v_percentage_used := 0; END IF;

                FOR v_escalation IN
                    SELECT e.* FROM sla_escalations e
                    WHERE e.is_active = TRUE AND e.trigger_type = 'percentage' AND e.sla_type = 'response'
                      AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    IF NOT EXISTS (SELECT 1 FROM ticket_activity_log WHERE ticket_id = v_ticket.id AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%' AND created_at > (NOW() - interval '24 hours')) THEN
                        -- Notify Logic...
                        SELECT user_id INTO v_supervisor_id FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                        IF v_supervisor_id IS NOT NULL THEN
                            PERFORM send_notification(v_supervisor_id, '⚠️ SLA Response Warning!', 'Tiket ' || v_ticket.ticket_number || ' mencapai ' || v_percentage_used || '% SLA. Agent: ' || COALESCE(v_ticket.agent_name, 'Unassigned'), 'escalation', 'ticket', v_ticket.id::TEXT);
                            v_notification_count := v_notification_count + 1;
                        END IF;
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id) VALUES (v_ticket.id, 'Escalation Rule: ' || v_escalation.name || ' at ' || v_percentage_used || '% Response SLA', v_ticket.assigned_to);
                    END IF;
                END LOOP;
            END IF;
        END IF;

        -- CHECK RESOLUTION SLA
        IF v_ticket.group_sla_policy_id IS NOT NULL THEN
            SELECT * INTO v_target FROM sla_targets
            WHERE sla_policy_id = v_ticket.group_sla_policy_id AND sla_type = 'resolution'
              AND LOWER(priority) = LOWER(v_ticket.priority::TEXT) LIMIT 1;

            IF v_target.id IS NOT NULL THEN
                v_sla_target_minutes := COALESCE(v_target.target_minutes, 240);
                IF v_sla_target_minutes > 0 THEN
                    v_percentage_used := ROUND((v_elapsed_minutes / v_sla_target_minutes) * 100, 2);
                ELSE v_percentage_used := 0; END IF;

                FOR v_escalation IN
                    SELECT e.* FROM sla_escalations e
                    WHERE e.is_active = TRUE AND e.trigger_type = 'percentage' AND e.sla_type = 'resolution'
                      AND e.trigger_value <= v_percentage_used
                      AND (e.policy_id = v_ticket.group_sla_policy_id OR e.sla_policy_id = v_ticket.group_sla_policy_id)
                    ORDER BY e.trigger_value DESC
                LOOP
                    IF NOT EXISTS (SELECT 1 FROM ticket_activity_log WHERE ticket_id = v_ticket.id AND action LIKE '%Escalation Rule: ' || v_escalation.name || '%' AND created_at > (NOW() - interval '24 hours')) THEN
                        SELECT user_id INTO v_supervisor_id FROM group_supervisors WHERE group_id = v_ticket.assignment_group_id LIMIT 1;
                        IF v_supervisor_id IS NOT NULL THEN
                            PERFORM send_notification(v_supervisor_id, '⚠️ SLA Resolution Warning!', 'Tiket ' || v_ticket.ticket_number || ' mencapai ' || v_percentage_used || '% SLA. Agent: ' || COALESCE(v_ticket.agent_name, 'Unassigned'), 'escalation', 'ticket', v_ticket.id::TEXT);
                            v_notification_count := v_notification_count + 1;
                        END IF;
                        INSERT INTO ticket_activity_log (ticket_id, action, actor_id) VALUES (v_ticket.id, 'Escalation Rule: ' || v_escalation.name || ' at ' || v_percentage_used || '% Resolution SLA', v_ticket.assigned_to);
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'processed_tickets', v_processed_count, 'notifications_sent', v_notification_count, 'executed_at', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
