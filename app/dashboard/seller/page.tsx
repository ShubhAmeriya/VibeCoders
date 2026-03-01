// =============================================================
// /app/dashboard/seller/page.tsx – Seller Dashboard Server Component
// Fetches: purchases (recent sales) + funding_requests (funding management)
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { SellerDashboardClient } from './SellerDashboardClient';
import type { Profile } from '@/types';

export type PurchaseRow = {
    id: string;
    kwh_bought: number;
    total_price: number;
    created_at: string;
    buyer: { username: string | null; email: string | null } | null;
    project: { energy_type: string | null } | null;
};

export type SellerFundingRequest = {
    id: string;
    organization_name: string;
    organization_type: 'government' | 'private';
    funding_goal_inr: number;
    funds_raised_inr: number;
    created_at: string;
    project: { energy_type: string; location: string | null } | null;
};

export default async function SellerDashboardPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile || profile.role !== 'seller') redirect('/dashboard');

    // ── Recent purchases (fixed query with FK-named joins) ────────
    const { data: rawPurchases, error: purchErr } = await supabase
        .from('purchases')
        .select(`
            id,
            kwh_bought,
            total_price,
            created_at,
            buyer:profiles!purchases_buyer_id_fkey (
                username,
                email
            ),
            project:energy_projects!purchases_project_id_fkey (
                energy_type
            )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (purchErr) console.error('[SellerDashboard] purchases error:', purchErr);
    const purchases = (rawPurchases ?? []) as unknown as PurchaseRow[];

    // ── Seller's funding requests ─────────────────────────────────
    const { data: rawFunding, error: fundErr } = await supabase
        .from('funding_requests')
        .select(`
            id,
            organization_name,
            organization_type,
            funding_goal_inr,
            funds_raised_inr,
            created_at,
            project:energy_projects (
                energy_type,
                location
            )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

    if (fundErr) console.error('[SellerDashboard] funding error:', fundErr);
    const fundingRequests = (rawFunding ?? []) as unknown as SellerFundingRequest[];

    return (
        <SellerDashboardClient
            profile={profile}
            purchases={purchases}
            fundingRequests={fundingRequests}
        />
    );
}
