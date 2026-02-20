
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
    const { data: policies, error: pError } = await supabase
        .from('sla_policies')
        .select('*');

    const { data: targets, error: tError } = await supabase
        .from('sla_targets')
        .select('*');

    if (pError || tError) { console.error(pError || tError); return; }

    const srPolicy = policies.find(p => p.name.includes('Service Request'));
    if (srPolicy) {
        console.log(`\n--- CONDITIONS for ${srPolicy.name} ---`);
        console.log(JSON.stringify(srPolicy.conditions, null, 2));
    }
}

check();
