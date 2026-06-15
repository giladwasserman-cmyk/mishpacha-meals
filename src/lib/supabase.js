import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // הודעה ברורה למפתח אם חסרים מפתחות
  console.error('חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY בקובץ .env')
}

export const supabase = createClient(url || 'http://localhost', anon || 'public-anon-key')
