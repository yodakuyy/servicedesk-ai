
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
    teamPulse: [],
    investigation: []
};

async function check() {
    console.log('--- Team Pulse RPC Check ---');
    const { data: teamPulse, error: rpcError } = await supabase.rpc('get_team_pulse');

    if (rpcError) {
        console.error('RPC Error:', rpcError);
        return;
    }

    results.teamPulse = teamPulse;
    const { data: statuses } = await supabase.from('ticket_statuses').select('*');
    results.all_statuses = statuses;

    const affectedAgents = (teamPulse || []).filter(a => a.overdue_count > 0);

    for (const agent of affectedAgents) {
        const agentResult = {
            agent_name: agent.full_name,
            agent_id: agent.agent_id,
            reported_overdue: agent.overdue_count,
            tickets: []
        };

        const { data: overdueTickets, error: ticketError } = await supabase
            .from('tickets')
            .select(`
                id, ticket_number, priority, created_at, status_id,
                ticket_statuses!fk_tickets_status(status_name)
            `)
            .eq('assigned_to', agent.agent_id);

        if (ticketError) {
            console.error(`Error fetching tickets for ${agent.full_name}:`, ticketError);
            continue;
        }

        (overdueTickets || []).forEach(t => {
            const statusName = t.ticket_statuses?.status_name || '';
            const isResolvedOrClosed = ['Resolved', 'Closed', 'Canceled'].includes(statusName);
            const isPendingOrWaiting = statusName.toLowerCase().includes('pending') || statusName.toLowerCase().includes('waiting');
            const isActive = !isResolvedOrClosed && !isPendingOrWaiting;

            const created = new Date(t.created_at);
            const now = new Date();
            const activeHours = (now - created) / (1000 * 60 * 60);

            let limit = 24;
            const p = (t.priority || '').toLowerCase();
            if (p.includes('urgent') || p.includes('critical')) limit = 4;
            else if (p.includes('high')) limit = 8;
            else if (p.includes('medium')) limit = 48;
            else if (p.includes('low')) limit = 120;

            const isOverdue = isActive && activeHours > limit;

            agentResult.tickets.push({
                ticket_number: t.ticket_number,
                status: statusName,
                priority: t.priority,
                created_at: t.created_at,
                activeHours,
                limit,
                isActive,
                isOverdue
            });
        });

        results.investigation.push(agentResult);
    }

    fs.writeFileSync('check_results.json', JSON.stringify(results, null, 2));
    console.log('Results written to check_results.json');
}

check();
