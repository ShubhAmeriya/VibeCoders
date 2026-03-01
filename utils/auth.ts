// =============================================================
// auth.ts – Client-side auth helpers
// =============================================================

import { createClient } from '@/lib/supabaseClient';

/**
 * Sign in with email and password via Supabase Auth.
 * Backend validation + RLS handles access control.
 */
export async function signInWithEmail(email: string, password: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

/**
 * Sign up with email and password.
 * After signup, a record is inserted into the profiles table.
 */
export async function signUpWithEmail(
    email: string,
    password: string,
    username: string,
    role: 'investor' | 'buyer' | 'seller'
) {
    const supabase = createClient();

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username, role }, // metadata; also used in DB trigger if configured
        },
    });

    if (authError || !authData.user)
        return { data: null, error: authError };

    // 🔥 Send welcome email
    await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            username,
        }),
    });

    // 2. Insert into profiles table
    // NOTE: In production, use a Supabase DB trigger on auth.users insert
    // to auto-create the profile record. This client-side insert is a fallback.
    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username,
        role,
        wallet_balance_usd: 1000, // Demo starting balance — matches DB default
    });

    return { data: authData, error: profileError };
}

/**
 * Sign in with Google OAuth.
 * Redirects to Google consent screen, then back to /auth/callback.
 * Google Client ID must be configured in Supabase Dashboard:
 * Authentication → Providers → Google → Client ID & Secret
 * TODO: INSERT GOOGLE CLIENT ID HERE (via Supabase Dashboard, not here directly)
 */
export async function signInWithGoogle() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });
    return { data, error };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Fetch the current user's profile from the profiles table.
 */
export async function getProfile(userId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
}
