
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

async function debugTeamPulse() {
    console.log('--- Debugging Team Pulse Data ---');

    // 1. Check profiles table summary
    const { data: profiles, error: pError } = await supabase.from('profiles').select('full_name, role_id');
    if (pError) console.error('Error fetching profiles:', pError);
    else {
        console.log(`Total profiles: ${profiles.length}`);
        const roles = profiles.reduce((acc, p) => {
            acc[p.role_id] = (acc[p.role_id] || 0) + 1;
            return acc;
        }, {});
        console.log('Role distribution:', roles);
    }

    // 2. Check current function result from script (usually as service role/anon)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_team_pulse');
    if (rpcError) {
        console.error('RPC Error:', rpcError);
    } else {
        console.log(`RPC returned ${rpcData?.length || 0} agents.`);
        if (rpcData && rpcData.length > 0) {
            console.log('First 3 agents:', rpcData.slice(0, 3));
        }
    }
}

debugTeamPulse();
