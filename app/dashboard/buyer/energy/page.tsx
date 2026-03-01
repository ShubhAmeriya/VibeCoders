import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, EnergyProject, EnergyPurchase } from '@/types';
import { EnergyMarketClient } from '@/app/dashboard/buyer/energy/EnergyMarketClient';

export default async function BuyerEnergyPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'buyer') redirect('/dashboard');

    // ── Fetch ALL energy projects (plain select, no join, no filter by owner) ──
    const { data: rawProjects, error: projectsError } = await supabase
        .from('energy_projects')
        .select('*')
        .order('created_at', { ascending: false });

    // ── DEBUG: show exactly what's happening ──
    if (projectsError) {
        return (
            <div className="card p-6 space-y-4">
                <h2 className="text-xl font-bold text-danger">⚠️ Energy Projects Query Error</h2>
                <p className="text-text-muted text-sm">The query to fetch energy projects failed. This is usually an RLS policy issue.</p>
                <div className="bg-surface-hover rounded-xl p-4 font-mono text-sm text-danger whitespace-pre-wrap">
                    {JSON.stringify(projectsError, null, 2)}
                </div>
                <div className="p-4 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm text-text-muted">
                    <p className="font-semibold text-text-primary mb-2">Fix: Run this in Supabase SQL Editor</p>
                    <pre className="text-xs overflow-x-auto">{`-- Enable RLS and add public read policy
alter table energy_projects enable row level security;

create policy "Public read"
  on energy_projects for select using (true);

create policy "Seller insert"
  on energy_projects for insert
  with check (auth.uid() = owner_id);`}</pre>
                </div>
            </div>
        );
    }

    // ── No error but empty — likely table doesn't exist or no projects yet ──
    if (!rawProjects || rawProjects.length === 0) {
        return (
            <div className="card p-6 space-y-4">
                <h2 className="text-xl font-bold text-text-primary">🌱 Energy Marketplace</h2>
                <div className="p-4 bg-surface-hover rounded-xl text-sm space-y-2">
                    <p className="text-text-muted"><span className="text-accent-green font-semibold">Query succeeded</span> but returned 0 projects.</p>
                    <p className="text-text-muted">Possible reasons:</p>
                    <ul className="list-disc list-inside text-text-muted space-y-1">
                        <li>No seller has created a project yet</li>
                        <li>All projects have <code className="text-xs bg-border px-1 rounded">total_kwh = 0</code> (sold out)</li>
                        <li>The <code className="text-xs bg-border px-1 rounded">energy_projects</code> table doesn't exist yet</li>
                    </ul>
                    <p className="text-text-muted mt-2">Ask a seller to log in and create a project at <strong>/dashboard/seller/energy</strong>.</p>
                </div>
            </div>
        );
    }

    // ── Projects loaded — proceed normally ──
    const projects = rawProjects as EnergyProject[];

    // Resolve seller usernames in a separate query (avoids FK join naming issues)
    const sellerIds = Array.from(new Set(projects.map(p => p.owner_id).filter(Boolean)));
    let sellerMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
            .from('profiles').select('id, username').in('id', sellerIds);
        if (sellers) sellerMap = Object.fromEntries(sellers.map(s => [s.id, s.username]));
    }

    const enrichedProjects: EnergyProject[] = projects.map(p => ({
        ...p,
        seller: { username: sellerMap[p.owner_id] ?? 'Unknown seller' },
    }));

    // Filter out sold-out projects after confirming data loads
    const availableProjects = enrichedProjects.filter(p => p.total_kwh > 0);

    // Buyer's purchases
    const { data: purchases } = await supabase
        .from('purchases')
        .select(`
        *,
        energy_projects (
            energy_type,
            location,
            price_per_kwh
        )
    `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

    return (
        <EnergyMarketClient
            profile={profile}
            projects={availableProjects}
            purchases={(purchases as EnergyPurchase[]) ?? []}
        />
    );
}
