
const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://vaoyksgpfkujugjaplke.supabase.co', 'sb_publishable_SDVFd0Ta40bkWLm7Wr1Fsg_sHnK7rHG');
async function go() {
    const { data: roles } = await s.from('roles').select('*');
    console.log(JSON.stringify(roles, null, 2));
}
go();
