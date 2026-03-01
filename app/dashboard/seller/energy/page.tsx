import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, EnergyProject } from '@/types';
import { EnergyProjectsClient } from '@/app/dashboard/seller/energy/EnergyProjectsClient';

// Seller-side purchase row with buyer + project name JOINs
export type SellerPurchaseRow = {
    id: string;
    buyer_id: string;
    seller_id: string;
    project_id: string;
    kwh_bought: number;
    total_price: number;
    created_at: string;
    // Joined: buyer:buyer_id(full_name)
    buyer?: {
        username: string | null;
    } | null;
    // Joined: energy_projects(name)
    energy_projects?: {
        name: string | null;
    } | null;
};

export default async function SellerEnergyPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'seller') redirect('/dashboard');

    // ── Seller's own projects ──────────────────────────────────────
    const { data: rawProjects, error: projectsError } = await supabase
        .from('energy_projects')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

    if (projectsError) console.log('Fetch error:', projectsError);

    const projects = (rawProjects as EnergyProject[]) ?? [];

    // ── 3️⃣ Seller purchase history with buyer + project name JOINs ──
    const { data: rawPurchases, error: purchasesError } = await supabase
        .from('purchases')
        .select(`
            *,
            buyer:buyer_id (
                username
            ),
            energy_projects (
                name
            )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

    if (purchasesError) console.log('Fetch error:', purchasesError);

    const purchases = (rawPurchases ?? []) as SellerPurchaseRow[];

    return (
        <EnergyProjectsClient
            profile={profile}
            projects={projects}
            purchases={purchases}
        />
    );
}
