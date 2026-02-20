
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
    const { data: ticket, error: tError } = await supabase
        .from('tickets')
        .select('priority, ticket_type')
        .eq('ticket_number', 'REQ-2790')
        .single();

    if (tError) { console.error(tError); return; }
    console.log('Ticket Data:', ticket);

    const { data: targets, error: targetError } = await supabase
        .from('sla_targets')
        .select('*');

    if (targetError) { console.error(targetError); return; }

    const srPolicy = (await supabase.from('sla_policies').select('id').ilike('name', '%Service Request%').single()).data;
    if (srPolicy) {
        const { data: targets } = await supabase.from('sla_targets').select('*').eq('sla_policy_id', srPolicy.id);
        console.log('Targets for Service Request Policy:');
        targets.forEach(t => console.log(`- Type: ${t.sla_type}, Priority: ${t.priority}, Mins: ${t.target_minutes}`));
    }
}

check();
