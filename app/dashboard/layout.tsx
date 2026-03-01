// =============================================================
// /app/dashboard/layout.tsx – Dashboard Shell
//
// This server component:
// 1. Fetches the authenticated user from Supabase
// 2. Fetches their profile (role, wallet balance, username)
// 3. Renders Sidebar + Navbar with role-aware navigation
// 4. Redirects to login if no session exists
// =============================================================

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import type { Profile } from '@/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user — uses secure server-side session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        redirect('/auth/login');
    }

    // Fetch profile from profiles table
    // NOTE: RLS ensures users can only read their own profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile) {
        // Profile doesn't exist (edge case) — redirect to finish setup
        redirect('/auth/login?error=no_profile');
    }

    return (
        <div className="flex min-h-screen bg-background">
            {/* Fixed sidebar */}
            <Sidebar role={profile.role} username={profile.username} />

            {/* Main content area — offset by sidebar width */}
            <div className="flex-1 flex flex-col ml-64 min-h-screen">
                <Navbar
                    username={profile.username}
                    role={profile.role}
                    walletBalance={profile.wallet_balance_usd}
                />
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
