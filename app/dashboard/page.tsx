// =============================================================
// /app/dashboard/page.tsx – Role-Based Redirect
//
// After login, users land here. We fetch their role
// and immediately redirect to the appropriate dashboard.
// =============================================================

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import type { Profile } from '@/types';

export default async function DashboardPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!profile) redirect('/auth/login');

    // Redirect to the role-specific dashboard
    if (profile.role === 'investor') redirect('/dashboard/investor');
    if (profile.role === 'seller') redirect('/dashboard/seller');
    if (profile.role === 'buyer') redirect('/dashboard/buyer');

    redirect('/auth/login');
}
