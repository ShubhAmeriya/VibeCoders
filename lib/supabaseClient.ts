// =============================================================
// supabaseClient.ts – Browser-side Supabase client
// Used in Client Components and browser-only contexts.
//
// IMPORTANT: Only the anon key is used here. Never expose
// the service role key on the client side.
// RLS (Row Level Security) policies on Supabase guard all data access.
// =============================================================

import { createBrowserClient } from '@supabase/ssr';

// TODO: INSERT SUPABASE URL HERE  →  fill in .env.local
// TODO: INSERT SUPABASE ANON KEY HERE  →  fill in .env.local
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
