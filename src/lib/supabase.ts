import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublicKey);
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabasePublicKey!)
  : null;

export function getSupabasePublicKey() {
  return supabasePublicKey;
}
