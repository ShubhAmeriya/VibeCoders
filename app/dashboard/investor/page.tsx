// =============================================================
// /app/dashboard/investor/page.tsx — Server Component
// Fetches: energy_projects (funding goal > 0) for investment marketplace
//          + investor's own investments joined with funding_requests (for portfolio)
// All monetary values in INR.
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { InvestorDashboardClient } from '@/app/dashboard/investor/InvestorDashboardClient';
import type { Profile } from '@/types';

// Shape of an energy project shown in the investor marketplace
export type FundingProject = {
    id: string;
    energy_type: 'solar' | 'wind' | 'biogas';
    location: string | null;
    description: string | null;
    funding_goal_inr: number;
    funds_raised_inr: number;
    owner: { username: string | null } | null;
};

// Shape of an investment row joined with project + funding_request details
export type InvestmentRow = {
    id: string;
    amount_invested_inr: number;
    created_at: string;
    project: {
        energy_type: string | null;
        funding_goal_inr: number | null;
        funds_raised_inr: number | null;
        location: string | null;
    } | null;
    // Joined funding_request for portfolio display
    funding_request: {
        organization_name: string | null;
        funding_goal_inr: number | null;
        funds_raised_inr: number | null;
    } | null;
};

export default async function InvestorDashboardPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile) redirect('/auth/login');
    if (profile.role !== 'investor') redirect('/dashboard');

    // ── 1. Energy projects with a funding goal (energy_projects table) ─
    const { data: rawProjects, error: projErr } = await supabase
        .from('energy_projects')
        .select('id, energy_type, location, description, funding_goal_inr, funds_raised_inr, owner_id')
        .gt('funding_goal_inr', 0)
        .order('created_at', { ascending: false });

    if (projErr) console.error('[InvestorDashboard] projects error:', projErr);

    let fundingProjects: FundingProject[] = [];

    if (rawProjects && rawProjects.length > 0) {
        // Try FK join for owner username
        const { data: withOwner, error: joinErr } = await supabase
            .from('energy_projects')
            .select(`
                id,
                energy_type,
                location,
                description,
                funding_goal_inr,
                funds_raised_inr,
                owner:profiles!energy_projects_owner_id_fkey (
                    username
                )
            `)
            .gt('funding_goal_inr', 0)
            .order('created_at', { ascending: false });

        if (!joinErr && withOwner && withOwner.length > 0) {
            fundingProjects = (withOwner as unknown[]).map((p: unknown) => {
                const proj = p as {
                    id: string; energy_type: 'solar' | 'wind' | 'biogas';
                    location: string | null; description: string | null;
                    funding_goal_inr: number | null; funds_raised_inr: number | null;
                    owner: { username: string | null } | null;
                };
                return {
                    id: proj.id,
                    energy_type: proj.energy_type,
                    location: proj.location,
                    description: proj.description,
                    funding_goal_inr: proj.funding_goal_inr ?? 0,
                    funds_raised_inr: proj.funds_raised_inr ?? 0,
                    owner: proj.owner ?? null,
                };
            });
        } else {
            // Fallback: resolve owner usernames separately
            const ownerIds = Array.from(new Set(
                (rawProjects as { owner_id: string }[]).map(p => p.owner_id).filter(Boolean)
            )) as string[];
            let sellerMap: Record<string, string | null> = {};
            if (ownerIds.length > 0) {
                const { data: sellers } = await supabase
                    .from('profiles').select('id, username').in('id', ownerIds);
                if (sellers) sellerMap = Object.fromEntries(
                    sellers.map((s: { id: string; username: string | null }) => [s.id, s.username])
                );
            }
            fundingProjects = (rawProjects as {
                id: string; energy_type: 'solar' | 'wind' | 'biogas';
                location: string | null; description: string | null;
                funding_goal_inr: number | null; funds_raised_inr: number | null; owner_id: string;
            }[]).map(p => ({
                id: p.id,
                energy_type: p.energy_type,
                location: p.location,
                description: p.description,
                funding_goal_inr: p.funding_goal_inr ?? 0,
                funds_raised_inr: p.funds_raised_inr ?? 0,
                owner: { username: sellerMap[p.owner_id] ?? null },
            }));
        }
    }

    // ── 2. This investor's investments joined with project + funding_request ─
    // First try: join investments → funding_requests + energy_projects
    const { data: rawInvestments, error: invErr } = await supabase
        .from('investments')
        .select(`
            id,
            amount_invested_inr,
            created_at,
            funding_id,
            project_id,
            project:project_id (
                energy_type,
                funding_goal_inr,
                funds_raised_inr,
                location
            )
        `)
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false });

    if (invErr) console.error('[InvestorDashboard] investments error:', invErr);

    // For each investment, try to fetch the corresponding funding_request
    let investments: InvestmentRow[] = [];
    if (rawInvestments && rawInvestments.length > 0) {
        const fundingIds = (rawInvestments as { funding_id: string | null }[])
            .map(i => i.funding_id)
            .filter(Boolean) as string[];

        let fundingMap: Record<string, { organization_name: string | null; funding_goal_inr: number | null; funds_raised_inr: number | null }> = {};

        if (fundingIds.length > 0) {
            const { data: fundReqs } = await supabase
                .from('funding_requests')
                .select('id, organization_name, funding_goal_inr, funds_raised_inr')
                .in('id', fundingIds);
            if (fundReqs) {
                fundingMap = Object.fromEntries(
                    (fundReqs as { id: string; organization_name: string | null; funding_goal_inr: number | null; funds_raised_inr: number | null }[])
                        .map(f => [f.id, { organization_name: f.organization_name, funding_goal_inr: f.funding_goal_inr, funds_raised_inr: f.funds_raised_inr }])
                );
            }
        }

        investments = (rawInvestments as unknown as {
            id: string;
            amount_invested_inr: number;
            created_at: string;
            funding_id: string | null;
            project: { energy_type: string | null; funding_goal_inr: number | null; funds_raised_inr: number | null; location: string | null } | null;
        }[]).map(inv => ({
            id: inv.id,
            amount_invested_inr: inv.amount_invested_inr,
            created_at: inv.created_at,
            project: inv.project ?? null,
            funding_request: inv.funding_id ? (fundingMap[inv.funding_id] ?? null) : null,
        }));
    }

    return (
        <InvestorDashboardClient
            profile={profile}
            fundingProjects={fundingProjects}
            investments={investments}
        />
    );
}
