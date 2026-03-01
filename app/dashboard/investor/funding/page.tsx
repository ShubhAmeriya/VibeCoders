// =============================================================
// /app/dashboard/investor/funding/page.tsx — Server Component
// Fetches: funding_requests, investor's investments, wallet balance
// All monetary values in INR.
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile } from '@/types';
import { FundingMarketClient } from './FundingMarketClient';

export type FundingRequest = {
    id: string;
    organization_name: string;
    organization_email: string | null;
    organization_type: 'government' | 'private';
    funding_goal_inr: number;
    funds_raised_inr: number;
    project: {
        energy_type: string;
        location: string | null;
        description: string | null;
    } | null;
    seller: {
        username: string | null;
    } | null;
};

export type FundingInvestmentRow = {
    id: string;
    amount_invested_inr: number;
    created_at: string;
    funding: {
        organization_name: string;
        funding_goal_inr: number;
        funds_raised_inr: number;
        project: { energy_type: string } | null;
    } | null;
};

export default async function InvestorFundingPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'investor') redirect('/dashboard');

    // ── Wallet balance in INR ─────────────────────────────────────
    // Use wallet_balance_inr if present, otherwise fall back to 0
    const walletBalanceInr: number = (profile as Profile & { wallet_balance_inr?: number }).wallet_balance_inr ?? 0;

    // ── All funding requests ──────────────────────────────────────
    const { data: rawFunding, error: fundErr } = await supabase
        .from('funding_requests')
        .select(`
            id,
            organization_name,
            organization_email,
            organization_type,
            funding_goal_inr,
            funds_raised_inr,
            project:energy_projects (
                energy_type,
                location,
                description
            ),
            seller:profiles (
                username
            )
        `)
        .order('created_at', { ascending: false });

    if (fundErr) console.error('[FundingPage] fetch error:', fundErr);
    const fundingRequests = (rawFunding ?? []) as unknown as FundingRequest[];

    // ── This investor's investments ───────────────────────────────
    const { data: rawInvestments, error: invErr } = await supabase
        .from('investments')
        .select(`
            id,
            amount_invested_inr,
            created_at,
            funding:funding_requests (
                organization_name,
                funding_goal_inr,
                funds_raised_inr,
                project:energy_projects (
                    energy_type
                )
            )
        `)
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false });

    if (invErr) console.error('[FundingPage] investments error:', invErr);
    const myInvestments = (rawInvestments ?? []) as unknown as FundingInvestmentRow[];

    return (
        <FundingMarketClient
            profile={profile}
            walletBalanceInr={walletBalanceInr}
            fundingRequests={fundingRequests}
            myInvestments={myInvestments}
        />
    );
}
