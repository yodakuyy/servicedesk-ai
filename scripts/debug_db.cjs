
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vaoyksgpfkujugjaplke.supabase.co';
const supabaseKey = 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    process.stdout.write("Checking companies...\n");
    try {
        const { data: depts, error: err1 } = await supabase.from('company').select('*');
        if (err1) {
            process.stderr.write("Error depts: " + JSON.stringify(err1) + "\n");
        } else {
            process.stdout.write("Companies count: " + depts.length + "\n");
            process.stdout.write(JSON.stringify(depts, null, 2) + "\n");
        }

        process.stdout.write("\nChecking SLA Policies...\n");
        const { data: policies, error: err2 } = await supabase.from('sla_policies').select('*');
        if (err2) {
            process.stderr.write("Error policies: " + JSON.stringify(err2) + "\n");
        } else {
            process.stdout.write("Policies count: " + (policies ? policies.length : 0) + "\n");
        }
    } catch (e) {
        process.stderr.write("Exception: " + e.message + "\n");
    }
}

check();
