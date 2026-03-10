
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.from('sla_escalations').select('*').limit(1);
    if (error) {
        console.error('Error fetching:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns in sla_escalations:', Object.keys(data[0]));
    } else {
        console.log('No data in sla_escalations to check columns');
    }
}

checkColumns();
