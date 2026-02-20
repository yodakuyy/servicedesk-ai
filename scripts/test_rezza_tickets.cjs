
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length) {
            process.env[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const agentId = '89c96259-5e14-4c50-af85-71c176dca5e7'; // Rezza
    console.log(`Checking tickets for Rezza (${agentId})`);

    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            id, ticket_number, priority, created_at, status_id,
            ticket_statuses!fk_tickets_status(status_name)
        `)
        .eq('assigned_to', agentId);

    if (error) { console.error(error); return; }

    console.log('Tickets found:', tickets.length);
    tickets.forEach(t => {
        console.log(`- ${t.ticket_number} | Priority: "${t.priority}" | Status: "${t.ticket_statuses?.status_name}" | Created: ${t.created_at}`);
    });

    // Run the subquery logic
    const { data: overdueStatuses } = await supabase
        .from('ticket_statuses')
        .select('status_id, status_name')
        .not('status_name', 'in', '("Resolved", "Closed", "Canceled")')
        .not('status_name', 'ilike', '%Pending%')
        .not('status_name', 'ilike', '%Waiting%');

    console.log('\nStatuses that CAN be overdue:');
    overdueStatuses.forEach(s => console.log(`  - ${s.status_name} (${s.status_id})`));

    const overdueStatusIds = overdueStatuses.map(s => s.status_id);

    const overdueOnes = tickets.filter(t => {
        if (!overdueStatusIds.includes(t.status_id)) return false;

        const created = new Date(t.created_at);
        const now = new Date();
        const diffHours = (now - created) / (1000 * 60 * 60);

        let limit = 24;
        if (t.priority === 'Urgent') limit = 4;
        else if (t.priority === 'High') limit = 8;
        else if (t.priority === 'Medium') limit = 48;
        else if (t.priority === 'Low') limit = 120;
        else limit = 24; // Fallback for 'high', 'medium', etc. if doesn't match case

        return diffHours > limit;
    });

    console.log('\nTickets that match OVERDUE logic in JS:');
    overdueOnes.forEach(t => console.log(`  - ${t.ticket_number}`));
}

check();
