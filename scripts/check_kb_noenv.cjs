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
    const { data: articles, error } = await supabase
        .from('kb_articles')
        .select('id, title, company_id')
        .order('id')

    console.log('--- KB ARTICLES ---')
    if (articles) {
        articles.forEach(a => {
            console.log(`ID: ${a.id} | CoID: ${a.company_id} | Title: ${a.title}`)
        })
    } else {
        console.error('Error fetching articles:', error)
    }
}

check()
