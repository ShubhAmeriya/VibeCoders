// =============================================================
// /app/api/energy/purchase/route.ts
//
// Handles energy kWh purchase — fully atomic via Postgres RPC.
//
// The `purchase_energy` RPC runs inside a single Postgres transaction:
//   1. Lock project row — check kWh availability
//   2. Lock buyer profile — check wallet balance
//   3. Deduct buyer wallet
//   4. Add to seller wallet
//   5. Reduce project total_kwh
//   6. Insert purchases record → returns purchase id + details
//
// After RPC success → fire-and-forget Resend email invoice to buyer.
// Email failure does NOT block the transaction response.
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

export async function POST(req: NextRequest) {
    try {
        const { projectId, kwh } = await req.json();

        if (!projectId || !kwh || isNaN(Number(kwh)) || Number(kwh) <= 0) {
            return NextResponse.json({ error: 'Invalid projectId or kwh' }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        // Authenticate the caller
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify they are a buyer
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'buyer') {
            return NextResponse.json({ error: 'Only buyers can purchase energy' }, { status: 403 });
        }

        // Call the atomic Postgres function
        const { data, error } = await supabase.rpc('purchase_energy', {
            buyer_id: user.id,
            project_id: projectId,
            kwh: Number(kwh),
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // ── Fire-and-forget email invoice ──────────────────────────
        // Run async without awaiting so it never delays the response
        void sendInvoiceEmail(supabase, user.id, projectId, Number(kwh), data).catch(
            (err) => console.error('[Invoice Email] Unexpected error:', err)
        );

        return NextResponse.json({ success: true, ...data });

    } catch (err) {
        console.error('[Energy Purchase API]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── Invoice email helper ────────────────────────────────────────

async function sendInvoiceEmail(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    buyerId: string,
    projectId: string,
    kwh: number,
    rpcResult: Record<string, unknown> | null,
) {
    try {
        // Fetch buyer profile, project details, and seller profile in parallel
        const [
            { data: buyer },
            { data: project },
        ] = await Promise.all([
            supabase
                .from('profiles')
                .select('full_name, username, email')
                .eq('id', buyerId)
                .single(),
            supabase
                .from('energy_projects')
                .select('energy_type, price_per_kwh, owner_id')
                .eq('id', projectId)
                .single(),
        ]);

        if (!buyer?.email) {
            console.warn('[Invoice Email] Buyer has no email — skipping.');
            return;
        }

        // Fetch seller name
        const { data: seller } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', project?.owner_id)
            .single();

        const buyerName = buyer.full_name ?? buyer.username ?? 'Buyer';
        const sellerName = seller?.full_name ?? seller?.username ?? 'Seller';
        const energyType = (project?.energy_type ?? 'energy').charAt(0).toUpperCase() +
            (project?.energy_type ?? 'energy').slice(1);
        const pricePerKwh: number = project?.price_per_kwh ?? 0;
        const totalPaid = kwh * pricePerKwh;
        const invoiceId = (rpcResult as Record<string, unknown>)?.purchase_id ?? `TXN-${Date.now()}`;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Energy Purchase Receipt</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">⚡ GreenGrid Exchange</div>
                    <div style="font-size:13px;color:#a7f3d0;margin-top:4px;">Renewable Energy Marketplace</div>
                  </td>
                  <td align="right">
                    <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 14px;font-size:12px;color:#ecfdf5;font-weight:600;">
                      PURCHASE RECEIPT
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:600;color:#f1f5f9;">Hello, ${buyerName}!</p>
              <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.6;">
                Thank you for your purchase on GreenGrid Exchange. Here is your invoice receipt.
              </p>

              <!-- Invoice Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;border:1px solid #334155;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;">Invoice ID</td>
                        <td align="right" style="font-size:12px;color:#94a3b8;font-family:monospace;">${invoiceId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#94a3b8;">Date &amp; Time</td>
                        <td align="right" style="font-size:13px;color:#e2e8f0;">${dateStr} at ${timeStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#94a3b8;">Buyer</td>
                        <td align="right" style="font-size:13px;color:#e2e8f0;">${buyerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#94a3b8;">Seller</td>
                        <td align="right" style="font-size:13px;color:#e2e8f0;">${sellerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#94a3b8;">Energy Type</td>
                        <td align="right" style="font-size:13px;color:#e2e8f0;">${energyType}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#94a3b8;">Quantity Purchased</td>
                        <td align="right" style="font-size:13px;color:#e2e8f0;">${kwh.toFixed(2)} kWh</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#94a3b8;">Price per kWh</td>
                        <td align="right" style="font-size:13px;color:#e2e8f0;">₹${pricePerKwh.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Total Row -->
                <tr>
                  <td style="padding:20px 24px;background:linear-gradient(135deg,rgba(6,95,70,0.3),rgba(13,148,136,0.2));">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:15px;font-weight:700;color:#34d399;">Total Paid</td>
                        <td align="right" style="font-size:20px;font-weight:800;color:#34d399;">₹${totalPaid.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px;color:#64748b;line-height:1.7;margin:0;">
                This is an automated receipt from GreenGrid Exchange. If you have any questions about this transaction, please contact our support team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">
                GreenGrid Exchange — Powering a Sustainable Future 🌱<br/>
                <span style="color:#334155;">This email was sent automatically after a successful transaction.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const { error: emailError } = await resend.emails.send({
            from: FROM_EMAIL,
            to: buyer.email,
            subject: 'Your Renewable Energy Purchase Receipt',
            html,
        });

        if (emailError) {
            console.error('[Invoice Email] Resend error:', emailError);
        } else {
            console.log('[Invoice Email] Sent successfully to', buyer.email);
        }
    } catch (err) {
        console.error('[Invoice Email] Failed to send:', err);
    }
}
