'use client';
// MarketProject now uses owner.username (FK join)

// =============================================================
// /app/dashboard/buyer/BuyerDashboardClient.tsx
//
// Three tabs:
//   🛒 Marketplace    — traditional products (products table)
//   ⚡ Energy Market  — energy_projects (kWh purchases)
//   📊 Summary        — metrics from both purchase types
//
// My Orders is removed from here → standalone page at /buyer/orders
// =============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { formatUSD, formatDate } from '@/utils/formatters';
import { createClient } from '@/lib/supabaseClient';
import type { Profile, Product, Order } from '@/types';
import type { MarketProject, BuyerEnergyPurchase } from '@/app/dashboard/buyer/page';

const CO2_PER_KWH = 0.7;

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10  text-blue-400  border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

type Tab = 'marketplace' | 'energy' | 'summary';

interface Props {
    profile: Profile;
    products: Product[];
    orders: Order[];
    energyProjects: MarketProject[];
    energyPurchases: BuyerEnergyPurchase[];
}

export function BuyerDashboardClient({ profile, products, orders, energyProjects, energyPurchases }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('marketplace');

    // ── Wallet balance (optimistic) ──────────────────────────────
    const [walletBalance, setWalletBalance] = useState(profile.wallet_balance_usd);

    // ─── 🛒 Product marketplace state ────────────────────────────
    const [productSearch, setProductSearch] = useState('');
    const [buyModal, setBuyModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [productBuying, setProductBuying] = useState(false);
    const [productBuyError, setProductBuyError] = useState('');

    // ─── ⚡ Energy market state ───────────────────────────────────
    const [energyFilter, setEnergyFilter] = useState<'all' | 'solar' | 'wind' | 'biogas'>('all');
    const [buyProject, setBuyProject] = useState<MarketProject | null>(null);
    const [kwh, setKwh] = useState('');
    const [energyBuying, setEnergyBuying] = useState(false);
    const [energyBuyError, setEnergyBuyError] = useState('');
    const [energyBuySuccess, setEnergyBuySuccess] = useState('');

    // ── Derived analytics ────────────────────────────────────────
    const totalKwh = energyPurchases.reduce((s, p) => s + p.kwh_bought, 0);
    const totalEnergySpent = energyPurchases.reduce((s, p) => s + p.total_price, 0);
    const totalProductSpent = orders.reduce((s, o) => s + o.total_amount, 0);
    const co2Saved = totalKwh * CO2_PER_KWH;

    const filteredProducts = products.filter((p) =>
        p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(productSearch.toLowerCase())
    );
    const filteredEnergy = energyFilter === 'all'
        ? energyProjects
        : energyProjects.filter((p) => p.energy_type === energyFilter);

    // ─── Product buy handler ─────────────────────────────────────
    async function handleProductBuy(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedProduct) return;
        const qty = parseInt(quantity);
        const total = qty * selectedProduct.price_usd;
        if (!qty || qty <= 0) { setProductBuyError('Enter a valid quantity.'); return; }
        if (qty > selectedProduct.quantity) { setProductBuyError('Not enough stock.'); return; }
        if (total > walletBalance) { setProductBuyError('Insufficient wallet balance.'); return; }

        setProductBuying(true); setProductBuyError('');
        const supabase = createClient();
        const { error } = await supabase.from('orders').insert({
            buyer_id: profile.id,
            product_id: selectedProduct.id,
            quantity: qty,
            total_amount: total,
        });
        setProductBuying(false);
        if (error) { setProductBuyError(error.message); return; }
        setWalletBalance((prev) => prev - total);
        setBuyModal(false);
        setQuantity('1');
        router.refresh();
    }

    // ─── Energy buy handler ──────────────────────────────────────
    function openEnergyBuy(project: MarketProject) {
        setBuyProject(project);
        setKwh('');
        setEnergyBuyError('');
        setEnergyBuySuccess('');
    }

    async function handleEnergyBuy(e: React.FormEvent) {
        e.preventDefault();
        if (!buyProject) return;
        const kwhNum = parseFloat(kwh);
        const cost = kwhNum * buyProject.price_per_kwh;

        if (!kwhNum || kwhNum <= 0) { setEnergyBuyError('Enter a valid kWh amount.'); return; }
        if (kwhNum > buyProject.total_kwh) { setEnergyBuyError(`Only ${buyProject.total_kwh.toFixed(0)} kWh available.`); return; }
        if (cost > walletBalance) { setEnergyBuyError(`Insufficient balance. Need ₹${cost.toFixed(2)}.`); return; }

        setEnergyBuying(true); setEnergyBuyError('');

        const res = await fetch('/api/energy/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: buyProject.id, kwh: kwhNum }),
        });
        const data = await res.json();
        setEnergyBuying(false);

        if (!res.ok || data.error) { setEnergyBuyError(data.error ?? 'Purchase failed. Please try again.'); return; }

        setWalletBalance((prev) => prev - (data.total_price ?? cost));
        setEnergyBuySuccess(
            `✅ Purchased ${kwhNum} kWh for ₹${(data.total_price ?? cost).toFixed(2)}. Saved ${(kwhNum * CO2_PER_KWH).toFixed(1)} kg CO₂!`
        );
        setKwh('');
        router.refresh();
    }

    function closeEnergyModal() { setBuyProject(null); setEnergyBuySuccess(''); setEnergyBuyError(''); }

    const kwhNum = parseFloat(kwh);
    const estCost = buyProject && kwhNum > 0 ? kwhNum * buyProject.price_per_kwh : 0;

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Buyer Dashboard</h1>
                    <p className="text-text-muted mt-1">
                        Welcome back, <span className="text-text-primary font-medium">{profile.username}</span>
                    </p>
                </div>
                <div className="card px-4 py-2 text-sm">
                    <span className="text-text-muted">Wallet: </span>
                    <span className="text-accent-green font-bold">{formatUSD(walletBalance)}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {([
                    ['marketplace', '🛒 Marketplace'],
                    ['energy', '⚡ Energy Market'],
                    ['summary', '📊 Summary'],
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

            {/* ══ 🛒 MARKETPLACE TAB ══════════════════════════════════ */}
            {activeTab === 'marketplace' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="section-title">Product Listings</h2>
                            <p className="text-xs text-text-muted mt-0.5">{products.length} products in stock</p>
                        </div>
                        <input
                            type="text"
                            placeholder="Search products…"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="input w-52 py-2 text-sm"
                        />
                    </div>

                    {filteredProducts.length === 0 ? (
                        <div className="card py-14 text-center">
                            <p className="text-3xl mb-2">🛒</p>
                            <p className="text-text-muted">{productSearch ? `No results for "${productSearch}"` : 'No products available right now.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredProducts.map((product) => (
                                <div key={product.id} className="card p-5 flex flex-col gap-3 hover:border-accent-blue/30 transition-colors">
                                    <div>
                                        <h4 className="font-semibold text-text-primary">{product.title}</h4>
                                        <p className="text-xs text-text-muted mt-1 line-clamp-2">{product.description}</p>
                                    </div>
                                    <div className="flex items-end justify-between pt-3 border-t border-border mt-auto">
                                        <div>
                                            <p className="text-lg font-bold text-accent-green">{formatUSD(product.price_usd)}</p>
                                            <p className="text-xs text-text-muted">{product.quantity} in stock</p>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedProduct(product); setQuantity('1'); setProductBuyError(''); setBuyModal(true); }}
                                            className="btn-primary text-sm"
                                            disabled={product.quantity === 0}
                                        >
                                            Buy Now
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ ⚡ ENERGY MARKET TAB ════════════════════════════════ */}
            {activeTab === 'energy' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="section-title">Energy Projects</h2>
                            <p className="text-xs text-text-muted mt-0.5">{energyProjects.length} projects available</p>
                        </div>
                        <div className="flex gap-2 text-sm">
                            {(['all', 'solar', 'wind', 'biogas'] as const).map((f) => (
                                <button key={f} onClick={() => setEnergyFilter(f)}
                                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${energyFilter === f ? 'bg-accent-green text-white' : 'bg-surface-hover text-text-muted hover:text-text-primary'
                                        }`}>
                                    {f === 'all' ? 'All' : `${ENERGY_ICONS[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Debug badge: always visible */}
                    <div className="text-xs text-text-muted px-1">
                        Received from Supabase: <span className="text-accent-green font-semibold">{energyProjects.length}</span> project(s)
                    </div>

                    {filteredEnergy.length === 0 ? (
                        <div className="card p-6 space-y-4">
                            <div className="text-center py-4">
                                <p className="text-3xl mb-2">🔍</p>
                                <p className="text-text-primary font-semibold">
                                    {energyProjects.length === 0
                                        ? 'No projects fetched from Supabase'
                                        : `No ${energyFilter} projects (${energyProjects.length} total loaded)`}
                                </p>
                                <p className="text-xs text-text-muted mt-1">
                                    {energyProjects.length === 0
                                        ? 'Check server logs for the exact error. Most likely cause: RLS policy blocking public read.'
                                        : 'Try selecting "All" filter above to see all energy types.'}
                                </p>
                            </div>
                            {energyProjects.length === 0 && (
                                <div className="bg-surface-hover rounded-xl p-4 text-xs font-mono space-y-2">
                                    <p className="text-yellow-400 font-semibold text-sm">⚠️ Fix: Run this in Supabase SQL Editor</p>
                                    <pre className="text-text-muted whitespace-pre-wrap overflow-x-auto">{`-- Allow all authenticated users to read energy_projects
CREATE POLICY "Public read energy_projects"
  ON energy_projects FOR SELECT
  USING (true);

-- If policy already exists, drop and recreate:
-- DROP POLICY "Public read energy_projects" ON energy_projects;`}</pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredEnergy.map((project) => (
                                <div key={project.id} className="card p-5 flex flex-col gap-3 hover:border-accent-green/30 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ENERGY_COLORS[project.energy_type]}`}>
                                                {ENERGY_ICONS[project.energy_type]} {project.energy_type.charAt(0).toUpperCase() + project.energy_type.slice(1)}
                                            </span>
                                            {project.location && <p className="text-xs text-text-muted">📍 {project.location}</p>}
                                            <p className="text-xs text-text-muted">
                                                🏭 <span className="text-text-primary font-medium">{project.owner?.username ?? 'Seller'}</span>
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-lg font-bold text-accent-green">₹{project.price_per_kwh.toFixed(2)}</p>
                                            <p className="text-xs text-text-muted">per kWh</p>
                                        </div>
                                    </div>

                                    {project.description && (
                                        <p className="text-xs text-text-muted line-clamp-2">{project.description}</p>
                                    )}

                                    <div className="flex items-end justify-between pt-3 border-t border-border mt-auto">
                                        <div>
                                            <p className="text-xs text-text-muted">Available</p>
                                            <p className="font-bold text-text-primary">{project.total_kwh.toFixed(0)} kWh</p>
                                            <p className="text-xs text-text-muted mt-0.5">
                                                ≈ {(project.total_kwh * CO2_PER_KWH).toFixed(0)} kg CO₂ savings
                                            </p>
                                        </div>
                                        <button onClick={() => openEnergyBuy(project)} className="btn-primary">
                                            Buy Energy
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ 📊 SUMMARY TAB ══════════════════════════════════════ */}
            {activeTab === 'summary' && (
                <div className="space-y-6">

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard label="Total kWh Bought" value={`${totalKwh.toFixed(0)} kWh`} sub="All energy purchases" color="text-accent-blue" />
                        <MetricCard label="Energy Spent" value={formatUSD(totalEnergySpent)} sub="Paid for energy" color="text-yellow-400" />
                        <MetricCard label="CO₂ Saved" value={`${co2Saved.toFixed(1)} kg`} sub="@ 0.7 kg/kWh 🌍" color="text-accent-green" />
                        <MetricCard label="Product Orders" value={String(orders.length)} sub={`${formatUSD(totalProductSpent)} spent`} color="text-text-primary" />
                    </div>

                    {/* Wallet */}
                    <div className="card p-5 flex items-center gap-4">
                        <div className="text-3xl">💳</div>
                        <div>
                            <p className="text-sm text-text-muted">Wallet Balance</p>
                            <p className="text-2xl font-bold text-accent-green">{formatUSD(walletBalance)}</p>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-sm text-text-muted">Total Combined Spend</p>
                            <p className="text-xl font-bold text-text-primary">{formatUSD(totalEnergySpent + totalProductSpent)}</p>
                        </div>
                    </div>

                    {/* Recent energy purchases */}
                    {energyPurchases.length > 0 && (
                        <div className="card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="section-title">Recent Energy Purchases</h3>
                                <a href="/dashboard/buyer/orders" className="text-xs text-accent-green hover:underline">View all →</a>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-text-muted text-left">
                                            <th className="pb-2 font-medium pr-4">Seller</th>
                                            <th className="pb-2 font-medium pr-4">Type</th>
                                            <th className="pb-2 font-medium pr-4">kWh</th>
                                            <th className="pb-2 font-medium pr-4">Paid</th>
                                            <th className="pb-2 font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {energyPurchases.slice(0, 5).map((p) => {
                                            const type = p.project?.energy_type ?? null;
                                            return (
                                                <tr key={p.id} className="table-row-hover">
                                                    <td className="py-2.5 pr-4 text-text-primary font-medium">{p.seller?.username ?? '—'}</td>
                                                    <td className="py-2.5 pr-4">
                                                        {type ? (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[type] ?? ''}`}>
                                                                {ENERGY_ICONS[type] ?? ''} {type.charAt(0).toUpperCase() + type.slice(1)}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="py-2.5 pr-4 font-semibold text-text-primary">{p.kwh_bought.toFixed(2)}</td>
                                                    <td className="py-2.5 pr-4 text-accent-green font-semibold">{formatUSD(p.total_price)}</td>
                                                    <td className="py-2.5 text-text-muted">{formatDate(p.created_at)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {energyPurchases.length === 0 && orders.length === 0 && (
                        <div className="card py-12 text-center">
                            <p className="text-3xl mb-2">🌱</p>
                            <p className="text-text-muted">No purchases yet. Explore the Marketplace or Energy Market to get started!</p>
                        </div>
                    )}
                </div>
            )}

            {/* ══ 🛒 PRODUCT BUY MODAL ════════════════════════════════ */}
            <Modal open={buyModal} onClose={() => setBuyModal(false)} title={`Buy: ${selectedProduct?.title ?? ''}`}>
                <form onSubmit={handleProductBuy} className="space-y-4">
                    <div className="p-4 bg-surface-hover rounded-xl text-sm space-y-1.5">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Price</span>
                            <span className="text-accent-green font-bold">{formatUSD(selectedProduct?.price_usd ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Stock</span>
                            <span className="text-text-primary">{selectedProduct?.quantity} units</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Your Wallet</span>
                            <span className="text-text-primary">{formatUSD(walletBalance)}</span>
                        </div>
                    </div>
                    {productBuyError && <p className="text-sm text-danger">{productBuyError}</p>}
                    <div>
                        <label className="input-label">Quantity</label>
                        <input type="number" min="1" max={selectedProduct?.quantity} required
                            value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" />
                        {selectedProduct && (
                            <p className="text-xs text-text-muted mt-1">
                                Total: <span className="text-accent-green font-semibold">{formatUSD((parseInt(quantity) || 0) * selectedProduct.price_usd)}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setBuyModal(false)} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={productBuying} className="btn-primary flex-1 disabled:opacity-60">
                            {productBuying ? 'Processing…' : 'Confirm Purchase'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ══ ⚡ ENERGY BUY MODAL ═════════════════════════════════ */}
            <Modal
                open={!!buyProject}
                onClose={closeEnergyModal}
                title={buyProject ? `Buy ${ENERGY_ICONS[buyProject.energy_type]} ${buyProject.energy_type.charAt(0).toUpperCase() + buyProject.energy_type.slice(1)} Energy` : ''}
            >
                {energyBuySuccess ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">
                            {energyBuySuccess}
                        </div>
                        <button onClick={closeEnergyModal} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleEnergyBuy} className="space-y-4">
                        <div className="p-4 bg-surface-hover rounded-xl text-sm space-y-1.5">
                            {buyProject?.owner?.username && (
                                <div className="flex justify-between pb-1.5 mb-1 border-b border-border">
                                    <span className="text-text-muted">Seller</span>
                                    <span className="font-semibold text-text-primary">🏭 {buyProject.owner.username}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-text-muted">Price / kWh</span>
                                <span className="text-accent-green font-bold">₹{buyProject?.price_per_kwh.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Available</span>
                                <span className="text-text-primary">{buyProject?.total_kwh.toFixed(0)} kWh</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Your Wallet</span>
                                <span className="text-text-primary">{formatUSD(walletBalance)}</span>
                            </div>
                        </div>

                        {energyBuyError && <p className="text-sm text-danger">{energyBuyError}</p>}

                        <div>
                            <label className="input-label">kWh to Purchase</label>
                            <input type="number" min="0.01" step="0.01" required
                                max={buyProject?.total_kwh}
                                value={kwh} onChange={(e) => setKwh(e.target.value)}
                                className="input" placeholder="e.g. 50" />
                        </div>

                        {kwhNum > 0 && buyProject && (
                            <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Estimated Cost</span>
                                    <span className="font-bold text-accent-green">{formatUSD(estCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-muted">CO₂ Saved</span>
                                    <span className="text-accent-green font-medium">{(kwhNum * CO2_PER_KWH).toFixed(2)} kg 🌍</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Balance After</span>
                                    <span className={`font-medium ${walletBalance - estCost < 0 ? 'text-danger' : 'text-text-primary'}`}>
                                        {formatUSD(walletBalance - estCost)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button type="button" onClick={closeEnergyModal} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={energyBuying} className="btn-primary flex-1 disabled:opacity-60">
                                {energyBuying ? 'Processing…' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </form>
                )}
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
