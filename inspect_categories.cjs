
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

async function inspectTable() {
    const { data, error } = await supabase.from('ticket_categories').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Columns in ticket_categories:', Object.keys(data[0] || {}));
    }
}

inspectTable();
