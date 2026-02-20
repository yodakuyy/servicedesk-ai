
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking portal_highlights table...');
    try {
        const { data, error, count } = await supabase
            .from('portal_highlights')
            .select('*', { count: 'exact' });

        if (error) {
            console.error('Error:', error.message);
            if (error.message.includes('not found')) {
                console.log('Table portal_highlights does not exist.');
            }
        } else {
            console.log('Table exists. Row count:', count);
            if (count > 0) {
                console.log('Sample Row:', data[0]);
            } else {
                console.log('Table is EMPTY.');
            }
        }
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

checkTable();
