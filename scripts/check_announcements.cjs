const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const env = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8')
const lines = env.split('\n')
let supabaseUrl = ''
let supabaseKey = ''

lines.forEach(line => {
    if (line.includes('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/^"/, '').replace(/"$/, '')
    if (line.includes('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/^"/, '').replace(/"$/, '')
})

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data: cols, error } = await supabase
        .from('announcements')
        .select('*')
        .limit(1)

    console.log('--- ANNOUNCEMENTS COLS ---')
    if (cols && cols.length > 0) {
        console.log(Object.keys(cols[0]))
    } else {
        console.log('No announcements found or error:', error)
    }
}

check()
