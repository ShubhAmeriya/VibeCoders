// =============================================================
// /app/dashboard/buyer/page.tsx  — Server Component
// ⚠️ DEBUG MODE — systematic diagnosis of empty marketplace
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { BuyerDashboardClient } from '@/app/dashboard/buyer/BuyerDashboardClient';
import type { Profile, Product, Order } from '@/types';

export type MarketProject = {
    id: string;
    energy_type: 'solar' | 'wind' | 'biogas';
    total_kwh: number;
    price_per_kwh: number;
    location: string | null;
    description: string | null;
    owner: { username: string | null } | null;
};

export type BuyerEnergyPurchase = {
    id: string;
    kwh_bought: number;
    total_price: number;
    created_at: string;
    seller: { username: string | null; email: string | null } | null;
    project: { energy_type: string | null } | null;
};

export default async function BuyerDashboardPage() {
    const supabase = await createServerSupabaseClient();

    // ── STEP 5: Verify Supabase connection URL ────────────────────
    console.log('═══════════════════════════════════════════');
    console.log('[DEBUG] NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('═══════════════════════════════════════════');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');
    console.log('[DEBUG] Authenticated user id:', user.id);

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile || profile.role !== 'buyer') redirect('/dashboard');

    // ── STEP 1: Raw fetch — ALL rows, no filter, no join ─────────
    const { data: debugProjects, error: debugErr } = await supabase
        .from('energy_projects')
        .select('*');

    console.log('─── STEP 1: Raw select("*") ───────────────');
    console.log('[DEBUG] ALL PROJECTS (no filter):', JSON.stringify(debugProjects));
    console.log('[DEBUG] Raw select error:', debugErr ? JSON.stringify(debugErr) : 'none');
    console.log('[DEBUG] Total rows in table:', debugProjects?.length ?? 'null (query failed)');

    // ── STEP 3: Plain query with stock filter — no FK join ────────
    const { data: projects, error: plainErr } = await supabase
        .from('energy_projects')
        .select('*')
        .gt('total_kwh', 0);

    console.log('─── STEP 3: Plain select with filter ──────');
    console.log('[DEBUG] PROJECTS (total_kwh > 0):', JSON.stringify(projects));
    console.log('[DEBUG] ERROR:', plainErr ? JSON.stringify(plainErr) : 'none');
    console.log('[DEBUG] Count:', projects?.length ?? 0);

    // ── STEP 4: FK join to verify constraint name ─────────────────
    const { data: joinedProjects, error: joinErr } = await supabase
        .from('energy_projects')
        .select(`
            id,
            energy_type,
            total_kwh,
            price_per_kwh,
            location,
            description,
            owner:profiles!energy_projects_owner_id_fkey (
                username
            )
        `)
        .gt('total_kwh', 0)
        .order('created_at', { ascending: false });

    console.log('─── STEP 4: FK join result ─────────────────');
    console.log('[DEBUG] FK join error:', joinErr ? JSON.stringify(joinErr) : 'none');
    console.log('[DEBUG] FK join count:', joinedProjects?.length ?? 0);
    if (joinedProjects?.length) {
        console.log('[DEBUG] FK join sample owner field:', JSON.stringify((joinedProjects[0] as { owner?: unknown }).owner));
    }
    console.log('═══════════════════════════════════════════');

    // ── Build energyProjects for UI ───────────────────────────────
    let energyProjects: MarketProject[] = [];

    if (joinedProjects && joinedProjects.length > 0 && !joinErr) {
        // FK join worked — check owner field
        const anyMissingOwner = (joinedProjects as { owner?: unknown }[]).some((p) => !p.owner);
        if (!anyMissingOwner) {
            console.log('[DEBUG] Using FK-joined data directly ✓');
            energyProjects = joinedProjects as unknown as MarketProject[];
        } else {
            console.warn('[DEBUG] FK join returned rows but owner is null — resolving usernames separately');
            // Resolve via separate query
            const ownerIds = Array.from(new Set(
                (debugProjects ?? []).map((p: { owner_id: string }) => p.owner_id).filter(Boolean)
            )) as string[];
            let sellerMap: Record<string, string | null> = {};
            if (ownerIds.length > 0) {
                const { data: sellers } = await supabase
                    .from('profiles').select('id, username').in('id', ownerIds);
                if (sellers) sellerMap = Object.fromEntries(sellers.map((s: { id: string; username: string | null }) => [s.id, s.username]));
            }
            energyProjects = (projects ?? []).map((p: { id: string; energy_type: 'solar' | 'wind' | 'biogas'; total_kwh: number; price_per_kwh: number; location: string | null; description: string | null; owner_id: string }) => ({
                id: p.id,
                energy_type: p.energy_type,
                total_kwh: p.total_kwh,
                price_per_kwh: p.price_per_kwh,
                location: p.location,
                description: p.description,
                owner: { username: sellerMap[p.owner_id] ?? null },
            }));
        }
    } else if (projects && projects.length > 0) {
        // Plain query worked but FK join didn't — use plain + separate profiles
        console.warn('[DEBUG] FK join failed/empty — using plain query + separate profiles');
        const ownerIds = Array.from(new Set(
            projects.map((p: { owner_id: string }) => p.owner_id).filter(Boolean)
        )) as string[];
        let sellerMap: Record<string, string | null> = {};
        if (ownerIds.length > 0) {
            const { data: sellers } = await supabase
                .from('profiles').select('id, username').in('id', ownerIds);
            if (sellers) sellerMap = Object.fromEntries(sellers.map((s: { id: string; username: string | null }) => [s.id, s.username]));
        }
        energyProjects = (projects as { id: string; energy_type: 'solar' | 'wind' | 'biogas'; total_kwh: number; price_per_kwh: number; location: string | null; description: string | null; owner_id: string }[]).map((p) => ({
            id: p.id,
            energy_type: p.energy_type,
            total_kwh: p.total_kwh,
            price_per_kwh: p.price_per_kwh,
            location: p.location,
            description: p.description,
            owner: { username: sellerMap[p.owner_id] ?? null },
        }));
    } else {
        console.error('[DEBUG] ❌ BOTH queries returned 0 rows.');
        console.error('[DEBUG] Possible causes:');
        console.error('[DEBUG]   1. No rows in energy_projects table (seller has not inserted yet)');
        console.error('[DEBUG]   2. RLS policy blocking SELECT for authenticated buyers');
        console.error('[DEBUG]   3. Wrong Supabase project URL in .env.local');
        console.error('[DEBUG] FIX: Run in Supabase SQL Editor →');
        console.error('[DEBUG]   CREATE POLICY "Public read energy_projects" ON energy_projects FOR SELECT USING (true);');
    }

    console.log('[DEBUG] Final energyProjects passed to client:', energyProjects.length);

    // ── Traditional products ──────────────────────────────────────
    const { data: rawProducts } = await supabase
        .from('products')
        .select('*')
        .gt('quantity', 0)
        .order('created_at', { ascending: false });
    const products = (rawProducts ?? []) as Product[];

    // ── Buyer's energy purchases ──────────────────────────────────
    const { data: rawPurchases } = await supabase
        .from('purchases')
        .select(`
            id,
            kwh_bought,
            total_price,
            created_at,
            seller:seller_id (
                username,
                email
            ),
            project:project_id (
                energy_type
            )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
    const energyPurchases = (rawPurchases ?? []) as unknown as BuyerEnergyPurchase[];

    // ── Buyer's product orders ────────────────────────────────────
    const { data: rawOrders } = await supabase
        .from('orders')
        .select('*, product:products(title, price_usd)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
    const orders = (rawOrders ?? []) as Order[];

    return (
        <BuyerDashboardClient
            profile={profile}
            energyProjects={energyProjects}
            products={products}
            energyPurchases={energyPurchases}
            orders={orders}
        />
    );
}
