// =============================================================
// /app/auth/callback/route.ts – Google OAuth callback handler
//
// After Google login, Supabase redirects here with a `code` param.
// We exchange the code for a session, then redirect the user.
// This also handles first-time Google sign-ins that need profile creation.
// =============================================================

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (!code) {
        return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
        return NextResponse.redirect(`${origin}/auth/login?error=oauth_error`);
    }

    // Check if a profile already exists for this user
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.session.user.id)
        .single();

    // If no profile exists (first Google login), create one with default role 'buyer'
    if (!profile) {
        const insertResult = await supabase.from('profiles').insert({
            id: data.session.user.id,
            username:
                data.session.user.user_metadata.full_name ||
                data.session.user.user_metadata.name ||
                data.session.user.email?.split('@')[0] ||
                'user',
            email: data.session.user.email ?? null,
            role: 'buyer', // Default role for Google sign-in
            wallet_balance_usd: 0,
        });
        if (insertResult.error) {
            console.error('[Auth Callback] Profile insert error:', insertResult.error);
        }
    }

    return NextResponse.redirect(`${origin}${next}`);
}
