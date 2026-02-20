
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envFile, 'utf8');
const processEnv = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length) {
        processEnv[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
});

const supabase = createClient(processEnv.VITE_SUPABASE_URL, processEnv.VITE_SUPABASE_ANON_KEY);

const sql = `
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
    p.full_name::TEXT,
    p.email::TEXT,
    p.role_id::INT,
    -- Hitung Tiket Active (Open, In Progress, Pending)
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name) IN ('open', 'in progress') 
            OR LOWER(s.status_name) LIKE '%pending%'
            OR LOWER(s.status_name) LIKE '%waiting%'
     ))::bigint as active_count,
    -- Hitung Tiket Resolved Hari Ini
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name) IN ('resolved', 'closed')
     )
     AND t.updated_at::date = CURRENT_DATE)::bigint as resolved_today_count,
    -- Hitung Tiket Overdue (Dynamic SLA, Exclude Pending)
    (SELECT COUNT(*) FROM public.tickets t 
     WHERE t.assigned_to = p.id 
     AND t.status_id IN (
         SELECT s.status_id FROM public.ticket_statuses s 
         WHERE LOWER(s.status_name) NOT IN ('resolved', 'closed', 'canceled')
           AND LOWER(s.status_name) NOT LIKE '%pending%'
           AND LOWER(s.status_name) NOT LIKE '%waiting%'
     )
     AND (
        (LOWER(t.priority) IN ('urgent', 'critical') AND t.created_at < (NOW() - INTERVAL '4 hours')) OR
        (LOWER(t.priority) = 'high' AND t.created_at < (NOW() - INTERVAL '8 hours')) OR
        (LOWER(t.priority) = 'medium' AND t.created_at < (NOW() - INTERVAL '48 hours')) OR
        (LOWER(t.priority) IN ('low', 'others') AND t.created_at < (NOW() - INTERVAL '120 hours')) OR
        -- Fallback default 24h
        (LOWER(COALESCE(t.priority, '')) NOT IN ('urgent', 'critical', 'high', 'medium', 'low', 'others') AND t.created_at < (NOW() - INTERVAL '24 hours'))
     )
    )::bigint as overdue_count
  FROM public.profiles p
  WHERE p.role_id IN (2, 3) 
  AND (
    v_viewer_role = 1 
    OR NOT EXISTS (SELECT 1 FROM public.user_groups WHERE user_id = v_viewer_id)
    OR p.id IN (
      SELECT ug2.user_id FROM public.user_groups ug2
      JOIN public.user_groups ug1 ON ug1.group_id = ug2.group_id
      WHERE ug1.user_id = v_viewer_id
    )
  )
  ORDER BY 
    CASE WHEN p.role_id = 2 THEN 0 ELSE 1 END ASC,
    active_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_pulse() TO service_role;
`;

// Supabase JS doesn't have a direct 'query' tool for raw SQL unless we use an RPC that allows it.
// Usually we can use 'postgres' if it's installed or just tell the user to run it.
// Assuming the user has a way to run it or I can use an existing RPC 'exec_sql' if it exists.

async function apply() {
    console.log('Applying SQL fix for get_team_pulse...');
    // In most of these projects, there is a 'supabase-manual-fix.sql' or similar.
    // I will write this to a file and tell the user I've prepared the fix.
    // BUT wait, I can try to use rpc('exec_sql', { sql }) if it exists.

    fs.writeFileSync('apply_fix.sql', sql);
    console.log('Fix script written to apply_fix.sql');
}

apply();
