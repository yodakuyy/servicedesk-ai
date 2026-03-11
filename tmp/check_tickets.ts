
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
    const { data, error } = await supabase.from('tickets').select('company_id').limit(1);
    if (error) {
        console.log('company_id does NOT exist on tickets table', error.message);
    } else {
        console.log('company_id EXISTS on tickets table');
    }
}
checkColumn();
