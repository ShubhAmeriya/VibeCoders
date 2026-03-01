// =============================================================
// /app/api/invest/route.ts
// Handles investor funding of energy projects.
// Flow:
//   1. Verify authenticated investor
//   2. Check wallet_balance_usd >= amountInr
//   3. Deduct wallet balance
//   4. Call invest_in_project RPC — atomic: inserts investment
//      AND increments energy_projects.funds_raised_inr
// If RPC fails, wallet deduction is rolled back.
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { projectId, amountInr } = await req.json();

        if (!projectId || !amountInr || isNaN(Number(amountInr)) || Number(amountInr) <= 0) {
            return NextResponse.json({ error: 'Invalid projectId or amountInr' }, { status: 400 });
        }

        const amount = Number(amountInr);
        const supabase = await createServerSupabaseClient();

        // Verify authenticated investor
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch current profile (role + wallet balance)
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('role, wallet_balance_usd')
            .eq('id', user.id)
            .single();

        if (profileErr || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        if (profile.role !== 'investor') {
            return NextResponse.json({ error: 'Only investors can invest' }, { status: 403 });
        }

        // ── Wallet balance check ─────────────────────────────────────
        const currentBalance = profile.wallet_balance_usd ?? 0;
        if (currentBalance < amount) {
            return NextResponse.json({
                error: `Insufficient wallet balance. You have ₹${currentBalance.toLocaleString('en-IN')} but need ₹${amount.toLocaleString('en-IN')}.`,
            }, { status: 400 });
        }

        // ── Deduct wallet balance ────────────────────────────────────
        const { error: deductErr } = await supabase
            .from('profiles')
            .update({ wallet_balance_usd: currentBalance - amount })
            .eq('id', user.id);

        if (deductErr) {
            console.error('[Invest API] Wallet deduction error:', deductErr);
            return NextResponse.json({ error: 'Failed to deduct wallet balance. Please try again.' }, { status: 500 });
        }

        // ── Call atomic RPC — inserts investment + updates funds_raised_inr ──
        const { data, error: rpcErr } = await supabase.rpc('invest_in_project', {
            p_investor_id: user.id,
            p_project_id: projectId,
            p_amount_inr: amount,
        });

        if (rpcErr) {
            console.error('[Invest API] RPC error:', rpcErr);
            // Roll back wallet deduction to keep data consistent
            await supabase
                .from('profiles')
                .update({ wallet_balance_usd: currentBalance })
                .eq('id', user.id);
            return NextResponse.json({ error: rpcErr.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, newBalance: currentBalance - amount, ...data });

    } catch (err) {
        console.error('[Invest API] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
