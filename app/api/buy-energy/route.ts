// =============================================================
// /app/api/buy-energy/route.ts
//
// Handles energy purchase — works with EITHER table name
//   • energy_projects  (original SQL instructions)
//   • projects         (alternative user-created table)
// and EITHER seller column name:
//   • seller_id  OR  owner_id
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// ── Helper: try fetching a project from multiple possible table/column combos ──
async function findProject(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, projectId: string) {
    const candidates = [
        { table: 'energy_projects', sellerCol: 'owner_id' },  // ← confirmed actual schema
        { table: 'energy_projects', sellerCol: 'seller_id' },
        { table: 'projects', sellerCol: 'seller_id' },
        { table: 'projects', sellerCol: 'owner_id' },
    ];

    for (const { table, sellerCol } of candidates) {
        const { data, error } = await supabase
            .from(table)
            .select(`id, ${sellerCol}, energy_type, total_kwh, price_per_kwh`)
            .eq('id', projectId)
            .maybeSingle();  // maybeSingle = no error if 0 rows, only errors on >1 or DB error

        if (error) {
            console.log(`[buy-energy] ${table}/${sellerCol} error:`, error.code, error.message);
            continue; // try next combo
        }
        if (data) {
            // Cast through unknown to avoid TS spread-type error
            const raw = data as unknown as Record<string, unknown>;
            const seller_id = raw[sellerCol] as string;
            return {
                table,
                sellerCol,
                project: {
                    id: raw['id'] as string,
                    seller_id,
                    energy_type: raw['energy_type'] as string,
                    total_kwh: raw['total_kwh'] as number,
                    price_per_kwh: raw['price_per_kwh'] as number,
                },
            };
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();

        // ── 1. Authenticate ──────────────────────────────────────
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated. Please log in.' }, { status: 401 });
        }

        // ── 2. Verify buyer role ──────────────────────────────────
        const { data: buyer, error: buyerErr } = await supabase
            .from('profiles')
            .select('id, wallet_balance_usd, role')
            .eq('id', user.id)
            .single();

        if (buyerErr || !buyer) {
            return NextResponse.json({ error: `Buyer profile not found. ${buyerErr?.message ?? ''}` }, { status: 404 });
        }
        if (buyer.role !== 'buyer') {
            return NextResponse.json({ error: 'Only buyers can purchase energy.' }, { status: 403 });
        }

        // ── 3. Parse body ─────────────────────────────────────────
        const body = await req.json();
        const projectId = String(body?.projectId ?? '');
        const kwh = Number(body?.kwh);

        if (!projectId || !kwh || kwh <= 0 || isNaN(kwh)) {
            return NextResponse.json({ error: 'Invalid projectId or kWh amount.' }, { status: 400 });
        }

        // ── 4. Find project (tries all table/column combos) ───────
        const found = await findProject(supabase, projectId);
        if (!found) {
            return NextResponse.json({
                error: `Project not found. Tried tables: energy_projects, projects. Ensure the project ID is correct and RLS allows reads.`,
            }, { status: 404 });
        }

        const { table: projectTable, sellerCol, project } = found;
        console.log(`[buy-energy] Found project in table="${projectTable}" sellerCol="${sellerCol}"`);

        // ── 5. Validate ───────────────────────────────────────────
        if (project.seller_id === user.id) {
            return NextResponse.json({ error: 'You cannot buy your own project.' }, { status: 403 });
        }
        if (project.total_kwh < kwh) {
            return NextResponse.json({
                error: `Only ${project.total_kwh} kWh available. You requested ${kwh} kWh.`
            }, { status: 400 });
        }

        const total_price = kwh * project.price_per_kwh;

        if (buyer.wallet_balance_usd < total_price) {
            return NextResponse.json({
                error: `Insufficient balance. Need ₹${total_price.toFixed(2)}, you have ₹${buyer.wallet_balance_usd.toFixed(2)}.`
            }, { status: 400 });
        }

        // ── 6. Sequential atomic updates ─────────────────────────

        // 6a. Deduct buyer wallet
        const { error: buyerUpdateErr } = await supabase
            .from('profiles')
            .update({ wallet_balance_usd: buyer.wallet_balance_usd - total_price })
            .eq('id', user.id);
        if (buyerUpdateErr) {
            console.error('[buy-energy] buyer deduct:', buyerUpdateErr);
            return NextResponse.json({ error: `Buyer wallet update failed: ${buyerUpdateErr.message}` }, { status: 500 });
        }

        // 6b. Credit seller wallet
        const { data: seller } = await supabase
            .from('profiles')
            .select('wallet_balance_usd')
            .eq('id', project.seller_id)
            .single();

        const { error: sellerUpdateErr } = await supabase
            .from('profiles')
            .update({ wallet_balance_usd: (seller?.wallet_balance_usd ?? 0) + total_price })
            .eq('id', project.seller_id);
        if (sellerUpdateErr) {
            // Rollback buyer
            await supabase.from('profiles')
                .update({ wallet_balance_usd: buyer.wallet_balance_usd })
                .eq('id', user.id);
            console.error('[buy-energy] seller credit:', sellerUpdateErr);
            return NextResponse.json({ error: `Seller wallet update failed: ${sellerUpdateErr.message}` }, { status: 500 });
        }

        // 6c. Reduce project kWh (using the table we actually found)
        const { error: projectUpdateErr } = await supabase
            .from(projectTable)
            .update({ total_kwh: project.total_kwh - kwh })
            .eq('id', projectId);
        if (projectUpdateErr) {
            console.error('[buy-energy] kwh reduce:', projectUpdateErr);
            return NextResponse.json({ error: `Project kWh update failed: ${projectUpdateErr.message}` }, { status: 500 });
        }

        // 6d. Insert into 'purchases' table (confirmed correct table name)
        const { error: purchaseErr } = await supabase
            .from('purchases')
            .insert({
                buyer_id: user.id,
                seller_id: project.seller_id,
                project_id: projectId,
                kwh_bought: kwh,
                total_price: total_price,
            });

        if (purchaseErr) {
            console.log('Purchase history insert error:', purchaseErr);
            return NextResponse.json({
                error: `Wallets updated but purchase history insert failed: ${purchaseErr.message}`
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            kwh_bought: kwh,
            total_price: total_price,
            new_balance: buyer.wallet_balance_usd - total_price,
        });

    } catch (err) {
        console.error('[buy-energy] unexpected:', err);
        return NextResponse.json({ error: `Internal server error: ${String(err)}` }, { status: 500 });
    }
}
