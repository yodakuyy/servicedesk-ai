
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Team Pulse RPC Check ---');
    const { data: teamPulse, error: rpcError } = await supabase.rpc('get_team_pulse');

    if (rpcError) {
        console.error('RPC Error:', rpcError);
        return;
    }

    console.log('Full Team Pulse Data:');
    console.table(teamPulse);

    console.log('\n--- Investigating Overdue Tickets for Affected Agents ---');
    const affectedAgents = teamPulse.filter(a => a.overdue_count > 0);

    for (const agent of affectedAgents) {
        console.log(`\nAgent: ${agent.full_name} (${agent.agent_id})`);

        // Match the logic in fix_team_pulse_overdue_logic.sql
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

        const filteredOverdue = overdueTickets.filter(t => {
            const statusName = t.ticket_statuses?.status_name || '';
            const isActive = !['Resolved', 'Closed', 'Canceled'].includes(statusName) &&
                !statusName.toLowerCase().includes('pending') &&
                !statusName.toLowerCase().includes('waiting');

            if (!isActive) return false;

            const created = new Date(t.created_at);
            const now = new Date();
            const activeHours = (now - created) / (1000 * 60 * 60);

            let limit = 24;
            const p = (t.priority || '').toLowerCase();
            if (p.includes('urgent') || p.includes('critical')) limit = 4;
            else if (p.includes('high')) limit = 8;
            else if (p.includes('medium')) limit = 48;
            else if (p.includes('low')) limit = 120;

            const isOverdue = activeHours > limit;
            if (isOverdue) {
                console.log(`  [OVERDUE] ${t.ticket_number} | Priority: ${t.priority} | Status: ${statusName} | Created: ${t.created_at} | Active Hours: ${activeHours.toFixed(1)}h | SLA Limit: ${limit}h`);
            } else if (isActive) {
                // console.log(`  [OK] ${t.ticket_number} | Priority: ${t.priority} | Status: ${statusName} | Created: ${t.created_at} | Active Hours: ${activeHours.toFixed(1)}h | SLA Limit: ${limit}h`);
            }
            return isOverdue;
        });

        console.log(`Calculated Overdue in Script: ${filteredOverdue.length}`);
    }
}

check();
