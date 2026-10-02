import { createClient } from '@supabase/supabase-js';

// A publishable/anon kulcs nyugodtan lehet a böngészőben:
// az adatokat a Row Level Security szabályok védik.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);
