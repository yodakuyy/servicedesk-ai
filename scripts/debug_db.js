
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vaoyksgpfkujugjaplke.supabase.co';
const supabaseKey = 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking companies...");
    const { data: depts, error: err1 } = await supabase.from('company').select('*');
    if (err1) console.error("Error depts:", err1);
    else console.log("Companies:", depts.length, JSON.stringify(depts, null, 2));

    console.log("\nChecking SLA Policies...");
    const { data: policies, error: err2 } = await supabase.from('sla_policies').select('*');
    if (err2) console.error("Error policies:", err2);
    else console.log("Policies:", policies.length);
}

check();
