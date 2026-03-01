// =============================================================
// /app/dashboard/buyer/orders/page.tsx — My Orders (Server Component)
// Shows BOTH: traditional product orders + energy purchases
// All from Supabase, sorted latest first within each section
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, Order } from '@/types';
import { formatUSD, formatDate } from '@/utils/formatters';
import { BuyerPDFButton } from '@/components/PDFButtons';

type EnergyPurchaseRow = {
    id: string;
    kwh_bought: number;
    total_price: number;
    created_at: string;
    seller: { username: string | null; email: string | null } | null;
    project: { energy_type: string | null } | null;
};

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10  text-blue-400  border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

export default async function BuyerOrdersPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'buyer') redirect('/dashboard');

    // ── 1. Traditional product orders ───────────────────────────
    const { data: rawOrders } = await supabase
        .from('orders')
        .select('*, product:products(title, price_usd)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
    const orders = (rawOrders ?? []) as Order[];

    // ── 2. Energy purchases ──────────────────────────────────────
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
    const purchases = (rawPurchases ?? []) as unknown as EnergyPurchaseRow[];

    // ── Combined stats ───────────────────────────────────────────
    const productSpent = orders.reduce((s, o) => s + o.total_amount, 0);
    const energySpent = purchases.reduce((s, p) => s + p.total_price, 0);
    const totalSpent = productSpent + energySpent;
    const totalOrders = orders.length + purchases.length;

    // Shape data for PDF
    const pdfEnergyOrders = purchases.map((p) => ({
        id: p.id,
        sellerName: p.seller?.username ?? null,
        energyType: p.project?.energy_type ?? null,
        kwhBought: p.kwh_bought,
        totalPaid: p.total_price,
        date: p.created_at,
    }));
    const pdfProductOrders = orders.map((o) => ({
        id: o.id,
        product: o.product?.title ?? null,
        quantity: o.quantity,
        totalPaid: o.total_amount,
        date: o.created_at,
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">My Orders</h1>
                    <p className="text-text-muted mt-1">All your purchases — marketplace &amp; energy market</p>
                </div>
                <BuyerPDFButton
                    username={profile.username}
                    energyOrders={pdfEnergyOrders}
                    productOrders={pdfProductOrders}
                />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-accent-green">{formatUSD(totalSpent)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-text-primary">{totalOrders}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Product Orders</p>
                    <p className="text-2xl font-bold text-accent-blue">{orders.length}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Energy Purchases</p>
                    <p className="text-2xl font-bold text-yellow-400">{purchases.length}</p>
                </div>
            </div>

            {/* ── Energy Purchases ──────────────────────────────────── */}
            <div className="card p-5">
                <h3 className="section-title mb-1">⚡ Energy Purchases</h3>
                <p className="text-xs text-text-muted mb-5">
                    {purchases.length} purchase{purchases.length !== 1 ? 's' : ''} from the Energy Market
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium pr-4">Order ID</th>
                                <th className="pb-3 font-medium pr-4">Seller</th>
                                <th className="pb-3 font-medium pr-4">Seller Email</th>
                                <th className="pb-3 font-medium pr-4">Energy Type</th>
                                <th className="pb-3 font-medium pr-4">kWh Bought</th>
                                <th className="pb-3 font-medium pr-4">Amount Paid</th>
                                <th className="pb-3 font-medium pr-4">Date</th>
                                <th className="pb-3 font-medium">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {purchases.map((p) => {
                                const d = new Date(p.created_at);
                                const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                const type = p.project?.energy_type ?? null;
                                return (
                                    <tr key={p.id} className="table-row-hover">
                                        <td className="py-3 pr-4 font-mono text-xs text-text-muted" title={p.id}>
                                            {p.id.slice(0, 8)}…
                                        </td>
                                        <td className="py-3 pr-4 text-text-primary font-medium whitespace-nowrap">
                                            {p.seller?.username ?? '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-text-muted text-xs whitespace-nowrap">
                                            {p.seller?.email ?? '—'}
                                        </td>
                                        <td className="py-3 pr-4">
                                            {type ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[type] ?? ''}`}>
                                                    {ENERGY_ICONS[type] ?? ''} {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-text-primary font-semibold">{p.kwh_bought.toFixed(2)}</td>
                                        <td className="py-3 pr-4 text-accent-green font-semibold">{formatUSD(p.total_price)}</td>
                                        <td className="py-3 pr-4 text-text-muted whitespace-nowrap">{formatDate(p.created_at)}</td>
                                        <td className="py-3 text-text-muted whitespace-nowrap">{timeStr}</td>
                                    </tr>
                                );
                            })}
                            {purchases.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-10 text-center text-text-muted">
                                        No energy purchases yet.{' '}
                                        <a href="/dashboard/buyer" className="text-accent-green hover:underline">Go to Energy Market →</a>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Product Orders ────────────────────────────────────── */}
            <div className="card p-5">
                <h3 className="section-title mb-1">🛒 Product Orders</h3>
                <p className="text-xs text-text-muted mb-5">
                    {orders.length} order{orders.length !== 1 ? 's' : ''} from the Marketplace
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium pr-4">Order ID</th>
                                <th className="pb-3 font-medium pr-4">Product</th>
                                <th className="pb-3 font-medium pr-4">Qty</th>
                                <th className="pb-3 font-medium pr-4">Unit Price</th>
                                <th className="pb-3 font-medium pr-4">Total Paid</th>
                                <th className="pb-3 font-medium pr-4">Date</th>
                                <th className="pb-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {orders.map((o) => (
                                <tr key={o.id} className="table-row-hover">
                                    <td className="py-3 pr-4 font-mono text-xs text-text-muted" title={o.id}>
                                        {o.id.slice(0, 8)}…
                                    </td>
                                    <td className="py-3 pr-4 font-semibold text-text-primary">{o.product?.title ?? '—'}</td>
                                    <td className="py-3 pr-4 text-text-primary">{o.quantity}</td>
                                    <td className="py-3 pr-4 text-text-muted">
                                        {o.product ? formatUSD(o.product.price_usd) : '—'}
                                    </td>
                                    <td className="py-3 pr-4 text-accent-green font-semibold">{formatUSD(o.total_amount)}</td>
                                    <td className="py-3 pr-4 text-text-muted">{formatDate(o.created_at)}</td>
                                    <td className="py-3"><span className="badge-green">Delivered</span></td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-text-muted">
                                        No product orders yet.{' '}
                                        <a href="/dashboard/buyer" className="text-accent-green hover:underline">Browse Marketplace →</a>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
