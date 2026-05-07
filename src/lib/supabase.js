import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://scloxlmnglqfnzcwfcop.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8D7KxSGMMKd900_4pyqILg_HUoL384U'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
