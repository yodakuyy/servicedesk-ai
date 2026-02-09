
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

async function check() {
    const agentId = '89c96259-5e14-4c50-af85-71c176dca5e7'; // Rezza

    const { data: statuses } = await supabase
        .from('ticket_statuses')
        .select('status_id, status_name');

    // Logic from line 65:
    const filteredStatuses = statuses.filter(s => {
        const name = s.status_name;
        const notInList = !['Resolved', 'Closed', 'Canceled'].includes(name);
        const notPending = !name.toLowerCase().includes('pending');
        const notWaiting = !name.toLowerCase().includes('waiting');
        return notInList && notPending && notWaiting;
    });

    const allowedIds = filteredStatuses.map(s => s.status_id);
    console.log('Allowed Status IDs for Overdue:', allowedIds);
    console.log('Allowed Status Names:', filteredStatuses.map(s => s.status_name));

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('assigned_to', agentId);

    console.log(`Total tickets for Rezza: ${tickets.length}`);

    let count = 0;
    tickets.forEach(t => {
        const inAllowed = allowedIds.includes(t.status_id);

        // Priority logic
        let overdue = false;
        const created = new Date(t.created_at);
        const now = new Date();
        const diffHours = (now - created) / (1000 * 60 * 60);

        if (inAllowed) {
            if (t.priority === 'Urgent' && diffHours > 4) overdue = true;
            else if (t.priority === 'High' && diffHours > 8) overdue = true;
            else if (t.priority === 'Medium' && diffHours > 48) overdue = true;
            else if (t.priority === 'Low' && diffHours > 120) overdue = true;
            else if (!['Urgent', 'High', 'Medium', 'Low'].includes(t.priority) && diffHours > 24) overdue = true;
        }

        console.log(`${t.ticket_number} | InAllowed: ${inAllowed} | Priority: ${t.priority} | Diff: ${diffHours.toFixed(1)}h | Overdue: ${overdue}`);
        if (overdue) count++;
    });

    console.log(`Final calculated overdue count: ${count}`);
}

check();
