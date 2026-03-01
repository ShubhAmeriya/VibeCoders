// =============================================================
// /app/api/razorpay/webhook/route.ts
//
// Razorpay Webhook Handler
//
// CRITICAL: This is the ONLY place wallet_balance_usd is updated
// after a payment. Webhook verification ensures the request is
// genuinely from Razorpay and not from a spoofed client.
//
// SECURITY:
// - Never update wallet from the frontend or the create-order route
// - Always verify the HMAC SHA-256 signature before updating DB
// - The RAZORPAY_SECRET is used ONLY here (server-side, never exposed)
//
// RLS NOTE:
// This route uses the Supabase Service Role Key to bypass RLS
// because it's a trusted server-side operation.
// NEVER use the service role key on the client side.
//
// TODO: INSERT RAZORPAY SECRET HERE (in .env.local, not here)
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Mark as dynamic — this is a POST-only webhook handler
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
    // Service role client (bypasses RLS — ONLY use on server-side trusted routes)
    // TODO: Add SUPABASE_SERVICE_ROLE_KEY to .env.local (never expose to client)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // fallback for dev
    );
    try {
        const body = await req.text();
        const signature = req.headers.get('x-razorpay-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
        }

        // STEP 1: Verify webhook signature (HMAC SHA-256)
        // The signature is: HMAC_SHA256(webhookBody, RAZORPAY_SECRET)
        // If this verification fails → reject the request immediately
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET!)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('[Razorpay Webhook] Signature mismatch — possible spoofed request');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        // STEP 2: Parse payload
        const event = JSON.parse(body);

        // STEP 3: Handle payment.captured event
        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const userId = payment.notes?.user_id;
            const amountUSD = payment.amount / 100; // Convert cents back to USD

            if (!userId) {
                return NextResponse.json({ error: 'Missing user_id in notes' }, { status: 400 });
            }

            // STEP 4: Update wallet balance in profiles table
            // NOTE: Use a Postgres function (RPC) in production for atomic increment
            const { data: profile, error: fetchError } = await supabaseAdmin
                .from('profiles')
                .select('wallet_balance_usd')
                .eq('id', userId)
                .single();

            if (fetchError || !profile) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ wallet_balance_usd: profile.wallet_balance_usd + amountUSD })
                .eq('id', userId);

            if (updateError) {
                console.error('[Razorpay Webhook] Failed to update wallet:', updateError);
                return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
            }

            // STEP 5: Log the transaction in wallet_transaction table
            await supabaseAdmin.from('wallet_transaction').insert({
                user_id: userId,
                type: 'credit',
                amount_usd: amountUSD,
            });

            console.log(`[Razorpay Webhook] Wallet credited: ${amountUSD} USD for user ${userId}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[Razorpay Webhook] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
