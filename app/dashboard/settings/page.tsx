// =============================================================
// /app/dashboard/settings/page.tsx – Account Settings
// Server Component: fetches profile, passes to SettingsClient
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile } from '@/types';
import { SettingsClient } from '@/app/dashboard/settings/SettingsClient';

export default async function SettingsPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile) redirect('/auth/login');

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
                <p className="text-text-muted mt-1">Manage your account preferences</p>
            </div>

            {/* Profile Info */}
            <div className="card p-6 space-y-5">
                <h3 className="section-title">Profile</h3>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-2xl">
                        {profile.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-text-primary">{profile.username}</p>
                        <p className="text-text-muted text-sm capitalize">{profile.role} account</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-text-muted mb-1">Role</p>
                        <span className="badge-blue capitalize">{profile.role}</span>
                    </div>
                    <div>
                        <p className="text-text-muted mb-1">Member since</p>
                        <p className="text-text-primary">
                            {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <div>
                        <p className="text-text-muted mb-1">Wallet Balance</p>
                        <p className="text-accent-green font-bold">
                            ₹{profile.wallet_balance_usd.toLocaleString('en-IN')}
                        </p>
                    </div>
                    <div>
                        <p className="text-text-muted mb-1">User ID</p>
                        <p className="text-xs text-text-muted font-mono">{user.id.slice(0, 16)}…</p>
                    </div>
                </div>
            </div>

            {/* Interactive security sections — client component */}
            <SettingsClient profile={profile} />
        </div>
    );
}
