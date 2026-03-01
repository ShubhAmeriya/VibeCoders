// =============================================================
// /app/api/account/delete/route.ts
// Deletes all user data then signs them out.
// The user is responsible for running the Supabase admin delete
// via a separate RPC or the Supabase dashboard.
//
// Flow:
//   1. Authenticate caller
//   2. Delete role-specific records (purchases / energy_projects / investments)
//   3. Delete the profiles row (cascades to other FK'd tables)
//   4. Call supabase.auth.signOut() — session is gone
//
// Note: Deleting from auth.users requires the service_role key.
// We use an RPC `delete_own_account` for that so we never expose service_role to client.
// =============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function DELETE() {
    try {
        const supabase = await createServerSupabaseClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles').select('role').eq('id', user.id).single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // ── Role-specific cleanup ─────────────────────────────────
        if (profile.role === 'buyer') {
            await supabase.from('purchases').delete().eq('buyer_id', user.id);
            await supabase.from('orders').delete().eq('buyer_id', user.id);
        }

        if (profile.role === 'seller') {
            // Delete purchases on seller's projects
            await supabase.from('purchases').delete().eq('seller_id', user.id);
            // Delete investments on seller's projects
            const { data: myProjects } = await supabase
                .from('energy_projects').select('id').eq('owner_id', user.id);
            if (myProjects && myProjects.length > 0) {
                const ids = myProjects.map((p: { id: string }) => p.id);
                await supabase.from('investments').delete().in('project_id', ids);
            }
            await supabase.from('energy_projects').delete().eq('owner_id', user.id);
        }

        if (profile.role === 'investor') {
            await supabase.from('investments').delete().eq('investor_id', user.id);
        }

        // ── Delete profile row ────────────────────────────────────
        await supabase.from('profiles').delete().eq('id', user.id);

        // ── Try RPC delete from auth.users (needs SECURITY DEFINER fn) ──
        const { error: rpcErr } = await supabase.rpc('delete_own_account');
        if (rpcErr) {
            // RPC may not exist — just sign out so session is cleared
            console.warn('[DeleteAccount] RPC not available:', rpcErr.message);
        }

        // Sign out
        await supabase.auth.signOut();

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('[DeleteAccount]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
