// =============================================================
// supabaseServer.ts – Server-side Supabase client
// Used in Server Components, Route Handlers, and Middleware.
//
// Uses cookies for session management (required for SSR auth).
// Never use createBrowserClient on the server side.
// =============================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
    const cookieStore = await cookies();

    return createServerClient(
        // TODO: INSERT SUPABASE URL HERE  →  fill in .env.local
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        // TODO: INSERT SUPABASE ANON KEY HERE  →  fill in .env.local
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Called from a Server Component; cookies are read-only.
                        // Middleware handles the actual cookie refresh.
                    }
                },
            },
        }
    );
}
