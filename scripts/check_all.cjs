
const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://vaoyksgpfkujugjaplke.supabase.co', 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG');

async function go() {
    const { data: depts } = await s.from('company').select('company_id, company_name, is_active');
    console.log("=== DEPARTMENTS ===");
    depts.forEach(d => console.log(`${d.company_id}: ${d.company_name} (Active: ${d.is_active})`));
}
go();
