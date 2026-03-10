import { createClient } from '@supabase/supabase-client'
import 'dotenv/config'

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
        articles.forEach(a => {
            console.log(`ID: ${a.id} | CoID: ${a.company_id} | Title: ${a.title}`)
        })
    } else {
        console.error('Error fetching articles:', error)
    }

    const { data: cats, error: err2 } = await supabase
        .from('kb_categories')
        .select('id, name, company_id')

    console.log('\n--- KB CATEGORIES ---')
    if (cats) {
        cats.forEach(c => {
            console.log(`ID: ${c.id} | CoID: ${c.company_id} | Name: ${c.name}`)
        })
    } else {
        console.error('Error fetching categories:', err2)
    }
}

check()
