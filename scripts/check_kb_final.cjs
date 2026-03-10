const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data: articles, error } = await supabase
        .from('kb_articles')
        .select('id, title, company_id')
        .order('id')

    console.log('--- KB ARTICLES ---')
    if (articles) {
        articles.map(a => {
            console.log(`ID: ${a.id} | CoID: ${a.company_id} | Title: ${a.title}`)
        })
    } else {
        console.error('Error fetching articles:', error)
    }
}

check()
