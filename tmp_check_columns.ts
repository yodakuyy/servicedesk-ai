
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  const { data, error } = await supabase.from('kb_articles').select('*').limit(1)
  if (error) {
    console.error(error)
    return
  }
  console.log('Columns:', Object.keys(data[0] || {}))
}

checkColumns()
