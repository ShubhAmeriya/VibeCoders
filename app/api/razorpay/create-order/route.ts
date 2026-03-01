// =============================================================
// /app/api/razorpay/create-order/route.ts
//
// Creates a Razorpay order for wallet funding.
//
// PAYMENT FLOW:
// 1. Frontend calls this route with { amount, userId }
// 2. This route creates a Razorpay order server-side (secure)
// 3. Frontend receives order ID and opens Razorpay checkout
// 4. User completes payment on Razorpay's hosted UI
// 5. Razorpay fires a webhook to /api/razorpay/webhook
// 6. Webhook verifies signature and updates wallet_balance_usd
//
// WHY NOT UPDATE WALLET HERE?
// Payment is not guaranteed at order creation. The wallet must
// only be updated AFTER webhook confirms successful payment.
// Updating here would allow wallet inflation without actual payment.
// =============================================================

import { NextRequest, NextResponse } from 'next/server';

// TODO: INSERT RAZORPAY KEY ID HERE
// TODO: INSERT RAZORPAY SECRET HERE
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET!;

export async function POST(req: NextRequest) {
    try {
        const { amount, userId } = await req.json();

        // Validate input
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Razorpay amounts are in the smallest currency unit (paise for INR, cents for USD)
        // We multiply by 100 to convert from USD to cents
        const amountInCents = Math.round(Number(amount) * 100);

        // Create order via Razorpay REST API
        const orderPayload = {
            amount: amountInCents,
            currency: 'USD',
            receipt: `wallet_${userId}_${Date.now()}`,
            notes: {
                user_id: userId,
                purpose: 'wallet_topup',
            },
        };

        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Basic auth: key_id:key_secret encoded as base64
                Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_SECRET}`).toString('base64')}`,
            },
            body: JSON.stringify(orderPayload),
        });

        if (!response.ok) {
            const err = await response.json();
            return NextResponse.json({ error: err.error?.description ?? 'Razorpay order failed' }, { status: 500 });
        }

        const order = await response.json();
        return NextResponse.json({ order });

    } catch (error) {
        console.error('[Razorpay] create-order error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
