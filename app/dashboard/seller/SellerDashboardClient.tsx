'use client';

// =============================================================
// /app/dashboard/seller/SellerDashboardClient.tsx
// Tabs: 📊 Sales Analytics | 📋 Orders | 💰 Funding Management
// =============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { createClient } from '@/lib/supabaseClient';
import type { Profile } from '@/types';
import type { PurchaseRow, SellerFundingRequest } from '@/app/dashboard/seller/page';
import { SalesPieChart } from '@/app/dashboard/seller/SalesPieChart';
import { formatUSD, formatDate } from '@/utils/formatters';
import { SellerPDFButton } from '@/components/PDFButtons';

interface Props {
    profile: Profile;
    purchases: PurchaseRow[];
    fundingRequests: SellerFundingRequest[];
}

type Tab = 'analytics' | 'orders' | 'funding';

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

function formatINR(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type Group = { revenue: number; kwh: number; count: number };

function groupByType(purchases: PurchaseRow[]): Record<string, Group> {
    const map: Record<string, Group> = {};
    for (const p of purchases) {
        const key = p.project?.energy_type ?? 'unknown';
        if (!map[key]) map[key] = { revenue: 0, kwh: 0, count: 0 };
        map[key].revenue += p.total_price;
        map[key].kwh += p.kwh_bought;
        map[key].count += 1;
    }
    return map;
}

type InvestorRow = {
    username: string | null;
    email: string | null;
    amount_invested_inr: number;
    created_at: string;
};

export function SellerDashboardClient({ profile, purchases, fundingRequests }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('analytics');

    // Create Product modal
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        energy_type: 'solar' as 'solar' | 'wind' | 'biogas',
        total_kwh: '',
        price_per_kwh: '',
        location: '',
        description: '',
        funding_goal_inr: '',
    });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // View Investors modal
    const [viewingFunding, setViewingFunding] = useState<SellerFundingRequest | null>(null);
    const [investors, setInvestors] = useState<InvestorRow[]>([]);
    const [loadingInvestors, setLoadingInvestors] = useState(false);

    // Metrics
    const totalSales = purchases.reduce((s, p) => s + p.total_price, 0);
    const totalKwh = purchases.reduce((s, p) => s + p.kwh_bought, 0);
    const totalOrders = purchases.length;
    const avgPrice = totalKwh > 0 ? totalSales / totalKwh : 0;
    const grouped = groupByType(purchases);
    const pieData = Object.entries(grouped).map(([type, g]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: g.revenue,
    }));

    const totalFundingGoal = fundingRequests.reduce((s, f) => s + (f.funding_goal_inr ?? 0), 0);
    const totalFundsRaised = fundingRequests.reduce((s, f) => s + (f.funds_raised_inr ?? 0), 0);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');
        setSuccessMsg('');
        const kwh = Number(form.total_kwh);
        const price = Number(form.price_per_kwh);
        if (!kwh || kwh < 1) { setFormError('Total kWh must be at least 1.'); return; }
        if (!price || price < 0.01) { setFormError('Price per kWh must be at least 0.01.'); return; }
        if (!form.location.trim()) { setFormError('Location is required.'); return; }
        if (!form.description.trim()) { setFormError('Description is required.'); return; }
        setSaving(true);
        const supabase = createClient();
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData?.user) {
            setFormError('Session expired — please reload and try again.');
            setSaving(false); return;
        }
        const fundingGoal = form.funding_goal_inr ? Number(form.funding_goal_inr) : null;
        if (fundingGoal !== null && (isNaN(fundingGoal) || fundingGoal < 0)) {
            setFormError('Funding goal must be a positive number.');
            setSaving(false); return;
        }
        const { error } = await supabase.from('energy_projects').insert({
            owner_id: userData.user.id,
            energy_type: form.energy_type,
            total_kwh: kwh,
            price_per_kwh: price,
            location: form.location.trim(),
            description: form.description.trim(),
            ...(fundingGoal !== null ? { funding_goal_inr: fundingGoal, funds_raised_inr: 0 } : {}),
        });
        setSaving(false);
        if (error) { setFormError(error.message); return; }
        setSuccessMsg('✅ Product listed successfully!');
        setForm({ energy_type: 'solar', total_kwh: '', price_per_kwh: '', location: '', description: '', funding_goal_inr: '' });
        router.refresh();
    }

    async function handleViewInvestors(funding: SellerFundingRequest) {
        setViewingFunding(funding);
        setLoadingInvestors(true);
        setInvestors([]);
        const supabase = createClient();
        const { data, error } = await supabase
            .from('investments')
            .select(`
                amount_invested_inr,
                created_at,
                investor:profiles!investments_investor_id_fkey (
                    username,
                    email
                )
            `)
            .eq('funding_id', funding.id)
            .order('created_at', { ascending: false });
        setLoadingInvestors(false);
        if (error) { console.error('[ViewInvestors] error:', error); return; }
        const rows = (data ?? []).map((d: unknown) => {
            const row = d as { amount_invested_inr: number; created_at: string; investor: { username: string | null; email: string | null } | null };
            return {
                username: row.investor?.username ?? null,
                email: row.investor?.email ?? null,
                amount_invested_inr: row.amount_invested_inr,
                created_at: row.created_at,
            };
        });
        setInvestors(rows);
    }

    function closeModal() {
        setShowCreate(false);
        setFormError('');
        setSuccessMsg('');
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Seller Dashboard</h1>
                    <p className="text-text-muted mt-1">
                        Welcome back, <span className="text-text-primary font-medium">{profile.username}</span>
                    </p>
                </div>
                <button
                    onClick={() => { setShowCreate(true); setFormError(''); setSuccessMsg(''); }}
                    className="btn-primary"
                >
                    + Add Product
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {([
                    ['analytics', '📊 Sales Analytics'],
                    ['orders', '📋 Orders'],
                    ['funding', '💰 Funding Management'],
                ] as [Tab, string][]).map(([tab, label]) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === tab
                                ? 'border-accent-green text-accent-green'
                                : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ══ SALES ANALYTICS TAB ══ */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-text-primary">Sales Analytics</p>
                            <p className="text-xs text-text-muted">{purchases.length} orders · all from Supabase</p>
                        </div>
                        <SellerPDFButton
                            username={profile.username}
                            sales={purchases.map((p) => ({
                                orderId: p.id,
                                buyerName: p.buyer?.username ?? null,
                                buyerEmail: p.buyer?.email ?? null,
                                energyType: p.project?.energy_type ?? null,
                                kwhSold: p.kwh_bought,
                                totalPaid: p.total_price,
                                date: p.created_at,
                            }))}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard label="Total Sales" value={formatUSD(totalSales)} sub="Sum of all revenue" color="text-accent-green" />
                        <MetricCard label="Total kWh Sold" value={`${totalKwh.toFixed(0)} kWh`} sub="Energy delivered" color="text-accent-blue" />
                        <MetricCard label="Total Orders" value={String(totalOrders)} sub="Completed purchases" color="text-text-primary" />
                        <MetricCard label="Avg Price / kWh" value={formatUSD(avgPrice)} sub="Blended sell rate" color="text-yellow-400" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="card p-5">
                            <h3 className="section-title mb-1">Revenue Distribution</h3>
                            <p className="text-xs text-text-muted mb-4">By energy type — live from Supabase</p>
                            <SalesPieChart data={pieData} />
                        </div>
                        <div className="card p-5">
                            <h3 className="section-title mb-1">Sales Per Product</h3>
                            <p className="text-xs text-text-muted mb-4">Grouped by energy type</p>
                            {Object.keys(grouped).length === 0 ? (
                                <div className="py-10 text-center">
                                    <p className="text-3xl mb-2">📊</p>
                                    <p className="text-text-muted text-sm">No sales yet. When buyers purchase your products, analytics will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(grouped).sort(([, a], [, b]) => b.revenue - a.revenue).map(([type, g]) => {
                                        const pct = totalSales > 0 ? (g.revenue / totalSales) * 100 : 0;
                                        return (
                                            <div key={type} className="space-y-1.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${ENERGY_COLORS[type] ?? 'text-text-muted border-border'}`}>
                                                        {ENERGY_ICONS[type] ?? '🔋'} {type.charAt(0).toUpperCase() + type.slice(1)}
                                                    </span>
                                                    <span className="text-accent-green font-semibold">{formatUSD(g.revenue)}</span>
                                                </div>
                                                <div className="w-full bg-surface-hover rounded-full h-1.5">
                                                    <div className="h-1.5 rounded-full bg-accent-green" style={{ width: `${pct.toFixed(1)}%` }} />
                                                </div>
                                                <p className="text-xs text-text-muted">
                                                    {g.kwh.toFixed(0)} kWh · {g.count} order{g.count !== 1 ? 's' : ''} · {pct.toFixed(1)}%
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ ORDERS TAB ══ */}
            {activeTab === 'orders' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="section-title">All Orders</h2>
                        <p className="text-xs text-text-muted mt-1">
                            {totalOrders} purchase{totalOrders !== 1 ? 's' : ''} — sorted latest first
                        </p>
                    </div>
                    <div className="card p-5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-text-muted text-left">
                                        <th className="pb-3 font-medium pr-4">Order ID</th>
                                        <th className="pb-3 font-medium pr-4">Buyer Name</th>
                                        <th className="pb-3 font-medium pr-4">Buyer Email</th>
                                        <th className="pb-3 font-medium pr-4">Product</th>
                                        <th className="pb-3 font-medium pr-4">Qty (kWh)</th>
                                        <th className="pb-3 font-medium pr-4">Amount Paid</th>
                                        <th className="pb-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {purchases.map((p) => {
                                        const type = p.project?.energy_type ?? null;
                                        return (
                                            <tr key={p.id} className="table-row-hover">
                                                <td className="py-3 pr-4 font-mono text-xs text-text-muted" title={p.id}>{p.id.slice(0, 8)}…</td>
                                                <td className="py-3 pr-4 text-text-primary font-medium whitespace-nowrap">{p.buyer?.username ?? '—'}</td>
                                                <td className="py-3 pr-4 text-text-muted text-xs whitespace-nowrap">{p.buyer?.email ?? '—'}</td>
                                                <td className="py-3 pr-4">
                                                    {type ? (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[type] ?? ''}`}>
                                                            {ENERGY_ICONS[type] ?? ''} {type.charAt(0).toUpperCase() + type.slice(1)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-text-primary font-semibold">{p.kwh_bought.toFixed(2)}</td>
                                                <td className="py-3 pr-4 text-accent-green font-semibold">{formatUSD(p.total_price)}</td>
                                                <td className="py-3 text-text-muted whitespace-nowrap">{formatDate(p.created_at)}</td>
                                            </tr>
                                        );
                                    })}
                                    {purchases.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-14 text-center text-text-muted">
                                                No orders yet — purchases will appear here automatically.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ FUNDING MANAGEMENT TAB ══ */}
            {activeTab === 'funding' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="section-title">Funding Management</h2>
                        <p className="text-xs text-text-muted mt-1">
                            {fundingRequests.length} funding request{fundingRequests.length !== 1 ? 's' : ''} — manage investor contributions
                        </p>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="card p-5">
                            <p className="text-sm text-text-muted mb-1">Total Funding Requests</p>
                            <p className="text-2xl font-bold text-text-primary">{fundingRequests.length}</p>
                        </div>
                        <div className="card p-5">
                            <p className="text-sm text-text-muted mb-1">Total Goal</p>
                            <p className="text-2xl font-bold text-text-primary">{formatINR(totalFundingGoal)}</p>
                        </div>
                        <div className="card p-5">
                            <p className="text-sm text-text-muted mb-1">Total Raised</p>
                            <p className="text-2xl font-bold text-accent-green">{formatINR(totalFundsRaised)}</p>
                        </div>
                    </div>

                    {fundingRequests.length === 0 ? (
                        <div className="card py-14 text-center">
                            <p className="text-3xl mb-2">💰</p>
                            <p className="text-text-primary font-semibold">No funding requests yet</p>
                            <p className="text-xs text-text-muted mt-1">Go to "My Products" → click "💰 Raise Funds" on any project card.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {fundingRequests.map((req) => {
                                const raised = req.funds_raised_inr ?? 0;
                                const goal = req.funding_goal_inr ?? 0;
                                const pct = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
                                const isFull = raised >= goal;

                                return (
                                    <div key={req.id} className="card p-5 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-text-primary">{req.organization_name}</p>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-muted capitalize">
                                                        {req.organization_type}
                                                    </span>
                                                </div>
                                                {req.project?.energy_type && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${ENERGY_COLORS[req.project.energy_type] ?? ''}`}>
                                                        {ENERGY_ICONS[req.project.energy_type] ?? ''} {req.project.energy_type}
                                                        {req.project.location && ` · ${req.project.location}`}
                                                    </span>
                                                )}
                                                <p className="text-xs text-text-muted">{formatDate(req.created_at)}</p>
                                            </div>
                                            <button
                                                onClick={() => handleViewInvestors(req)}
                                                className="btn-secondary text-sm flex-shrink-0"
                                            >
                                                View Investors
                                            </button>
                                        </div>

                                        {/* Progress */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-text-muted">
                                                <span>Raised: <span className="text-accent-green font-semibold">{formatINR(raised)}</span></span>
                                                <span>Goal: <span className="text-text-primary font-semibold">{formatINR(goal)}</span></span>
                                            </div>
                                            <div className="h-2 bg-border rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${isFull ? 'bg-accent-green' : 'bg-accent-blue'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-accent-blue font-semibold">{pct.toFixed(1)}% funded</span>
                                                {isFull && <span className="text-accent-green font-semibold">✓ Fully Funded</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══ CREATE PRODUCT MODAL ══ */}
            <Modal open={showCreate} onClose={closeModal} title="Add Energy Product">
                {successMsg ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">{successMsg}</div>
                        <button onClick={closeModal} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-4">
                        {formError && <p className="text-sm text-danger">{formError}</p>}
                        <div>
                            <label className="input-label">Energy Type</label>
                            <select value={form.energy_type} onChange={(e) => setForm((f) => ({ ...f, energy_type: e.target.value as 'solar' | 'wind' | 'biogas' }))} className="input">
                                <option value="solar">☀️ Solar</option>
                                <option value="wind">🌬️ Wind</option>
                                <option value="biogas">🌿 Biogas</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="input-label">Total kWh</label>
                                <input type="number" required min="1" step="1" placeholder="e.g. 1000" className="input" value={form.total_kwh} onChange={(e) => setForm((f) => ({ ...f, total_kwh: e.target.value }))} />
                            </div>
                            <div>
                                <label className="input-label">Price per kWh (₹)</label>
                                <input type="number" required min="0.01" step="0.01" placeholder="e.g. 6.50" className="input" value={form.price_per_kwh} onChange={(e) => setForm((f) => ({ ...f, price_per_kwh: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label className="input-label">Location</label>
                            <input type="text" required placeholder="e.g. Rajasthan, India" className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                        </div>
                        <div>
                            <label className="input-label">Description</label>
                            <textarea required rows={3} placeholder="Brief description of your energy project…" className="input resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="pt-1 border-t border-border">
                            <label className="input-label">Funding Goal (₹ INR) <span className="text-text-muted font-normal">(optional)</span></label>
                            <input type="number" min="0" step="1" placeholder="e.g. 100000" className="input" value={form.funding_goal_inr} onChange={(e) => setForm((f) => ({ ...f, funding_goal_inr: e.target.value }))} />
                            <p className="text-xs text-text-muted mt-1">Set a goal to let investors fund this project. Leave blank to skip.</p>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                                {saving ? 'Creating…' : 'List Product'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* ══ VIEW INVESTORS MODAL ══ */}
            <Modal
                open={!!viewingFunding}
                onClose={() => setViewingFunding(null)}
                title={viewingFunding ? `Investors — ${viewingFunding.organization_name}` : ''}
            >
                <div className="space-y-4">
                    {loadingInvestors ? (
                        <p className="text-center text-text-muted py-6">Loading investors…</p>
                    ) : investors.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-3xl mb-2">👥</p>
                            <p className="text-text-muted text-sm">No investors yet for this funding request.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm flex justify-between">
                                <span className="text-text-muted">{investors.length} investor{investors.length !== 1 ? 's' : ''}</span>
                                <span className="text-accent-green font-bold">
                                    {formatINR(investors.reduce((s, i) => s + i.amount_invested_inr, 0))} total
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-text-muted text-left">
                                            <th className="pb-3 font-medium pr-4">Investor</th>
                                            <th className="pb-3 font-medium pr-4">Amount</th>
                                            <th className="pb-3 font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {investors.map((inv, idx) => (
                                            <tr key={idx} className="table-row-hover">
                                                <td className="py-3 pr-4">
                                                    <p className="text-text-primary font-medium">{inv.username ?? '—'}</p>
                                                    <p className="text-xs text-text-muted">{inv.email ?? ''}</p>
                                                </td>
                                                <td className="py-3 pr-4 text-accent-green font-bold">{formatINR(inv.amount_invested_inr)}</td>
                                                <td className="py-3 text-text-muted whitespace-nowrap">{formatDate(inv.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <button onClick={() => setViewingFunding(null)} className="btn-secondary w-full">Close</button>
                </div>
            </Modal>
        </div>
    );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
    return (
        <div className="card p-5 flex flex-col gap-1">
            <p className="text-sm text-text-muted">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-text-muted">{sub}</p>
        </div>
    );
}
