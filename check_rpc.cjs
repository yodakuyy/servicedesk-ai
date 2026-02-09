
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
    console.log('--- Testing Overdue Status Filter ---');
    const { data: allStatuses } = await supabase.from('ticket_statuses').select('*');

    console.log('All statuses:');
    allStatuses.forEach(s => {
        const isExcluded = ['Resolved', 'Closed', 'Canceled'].includes(s.status_name) ||
            s.status_name.toLowerCase().includes('pending') ||
            s.status_name.toLowerCase().includes('waiting');
        console.log(`- ${s.status_name} | Excluded: ${isExcluded}`);
    });

    // Test the ILIKE logic as if it was SQL
    const { data: includedStatuses, error } = await supabase.rpc('get_test_statuses');
    // Wait, I don't have that RPC. I'll just use a raw query if possible, or just trust the ILIKE behavior.
}

// Better: Run a query that mimics the RPC's overdue count for the specific agents
async function checkOverdueCountManual() {
    const agentId = '89c96259-5e14-4c50-af85-71c176dca5e7'; // Rezza
    const { data, error } = await supabase.rpc('get_team_pulse');
    const rezza = data.find(a => a.agent_id === agentId);
    console.log(`RPC reports for Rezza: Overdue = ${rezza?.overdue_count}`);
}

checkOverdueCountManual();
