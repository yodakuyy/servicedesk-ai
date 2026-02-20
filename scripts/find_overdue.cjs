
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
    const agents = [
        { id: '89c96259-5e14-4c50-af85-71c176dca5e7', name: 'Rezza' },
        { id: 'c7c4573c-d6ed-4d6d-9db8-8ba561470d4c', name: 'Hanif' }
    ];

    for (const agent of agents) {
        console.log(`--- Checking ${agent.name} ---`);
        const { data: tickets } = await supabase
            .from('tickets')
            .select('id, ticket_number, priority, status_id, created_at, ticket_statuses(status_name)')
            .eq('assigned_to', agent.id);

        for (const t of tickets) {
            const statusName = t.ticket_statuses?.status_name || 'UNKNOWN';
            const isResolvedOrClosed = ['Resolved', 'Closed', 'Canceled'].includes(statusName);
            const isPendingOrWaiting = statusName.toLowerCase().includes('pending') || statusName.toLowerCase().includes('waiting');
            const isActive = !isResolvedOrClosed && !isPendingOrWaiting;

            const created = new Date(t.created_at);
            const now = new Date();
            const diffHours = (now - created) / (1000 * 60 * 60);

            // SQL Logic Match
            let sqlLimit = 24;
            if (t.priority === 'Urgent') sqlLimit = 4;
            else if (t.priority === 'High') sqlLimit = 8;
            else if (t.priority === 'Medium') sqlLimit = 48;
            else if (t.priority === 'Low') sqlLimit = 120;
            else sqlLimit = 24; // This catches 'high', 'medium' etc.

            const isSqlOverdue = isActive && diffHours > sqlLimit;

            console.log(`${t.ticket_number} | Status: ${statusName} | Priority: "${t.priority}" | Created: ${t.created_at} | Diff: ${diffHours.toFixed(1)}h | Limit: ${sqlLimit}h | Overdue: ${isSqlOverdue}`);
        }
    }
}

check();
