
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: tickets } = await supabase.from('tickets').select('priority, assigned_agent_id');
    const priorities = [...new Set(tickets.map(t => t.priority))];
    const unassigned = tickets.filter(t => !t.assigned_agent_id).length;
    console.log('Priorities in DB:', priorities);
    console.log('Unassigned total:', unassigned);
}
check();
