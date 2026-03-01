'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { formatUSD, formatDate } from '@/utils/formatters';
import { createClient } from '@/lib/supabaseClient';
import type { Profile, EnergyProject, EnergyPurchase } from '@/types';

const CO2_PER_KWH = 0.8; // kg CO₂ saved per kWh of renewable energy

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

interface Props {
    profile: Profile;
    projects: EnergyProject[];
    purchases: EnergyPurchase[];
}

export function EnergyMarketClient({ profile, projects, purchases }: Props) {
    const router = useRouter();
    const [buyModal, setBuyModal] = useState(false);
    const [selectedProject, setSelected] = useState<EnergyProject | null>(null);
    const [kwh, setKwh] = useState('');
    const [buying, setBuying] = useState(false);
    const [buyError, setBuyError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [filter, setFilter] = useState<'all' | 'solar' | 'wind' | 'biogas'>('all');

    // Live wallet balance — initialised from server prop, updated immediately after purchase
    const [walletBalance, setWalletBalance] = useState(profile.wallet_balance_usd);

    // CO₂ impact
    const totalKwhBought = purchases.reduce((s, p) => s + p.kwh_bought, 0);
    const totalCO2Saved = totalKwhBought * CO2_PER_KWH;
    const totalSpent = purchases.reduce((s, p) => s + p.total_price, 0);

    // Estimated cost
    const kwhNum = parseFloat(kwh);
    const estCost = selectedProject && kwhNum > 0 ? kwhNum * selectedProject.price_per_kwh : 0;

    
    const filtered = filter === 'all' ? projects : projects.filter(p => p.energy_type === filter);

    function openBuy(project: EnergyProject) {
        setSelected(project); setKwh(''); setBuyError(''); setSuccessMsg(''); setBuyModal(true);
    }

    async function handleBuy(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        const amount = parseFloat(kwh);
        if (!amount || amount <= 0) { setBuyError('Enter a valid kWh amount.'); return; }
        if (amount > selectedProject.total_kwh) { setBuyError(`Only ${selectedProject.total_kwh.toFixed(2)} kWh available.`); return; }
        if (estCost > walletBalance) { setBuyError('Insufficient wallet balance.'); return; }

        setBuying(true); setBuyError('');
        const res = await fetch('/api/energy/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: selectedProject.id, kwh: amount }),
        });
        const data = await res.json();
        setBuying(false);

        if (!res.ok || data.error) {
            setBuyError(data.error ?? 'Purchase failed. Please try again.');
            return;
        }

        // ✅ Immediately deduct from local wallet state so UI updates instantly
        setWalletBalance(prev => prev - (data.total_price ?? estCost));
        setSuccessMsg(`✅ Purchased ${amount} kWh for ${formatUSD(data.total_price)}. You saved ${(amount * CO2_PER_KWH).toFixed(1)} kg CO₂!`);
        setKwh('');
        router.refresh(); // syncs server data (project kWh remaining, purchase history) in background
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary">🌱 Energy Marketplace</h1>
                <p className="text-text-muted mt-1">Purchase renewable energy directly from sellers</p>
            </div>

            {/* Impact + Wallet stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Wallet Balance</p>
                    <p className="text-2xl font-bold text-accent-green">{formatUSD(walletBalance)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Energy Purchased</p>
                    <p className="text-2xl font-bold text-accent-blue">{totalKwhBought.toFixed(1)} kWh</p>
                </div>
                <div className="card p-5 border border-accent-green/20">
                    <p className="text-sm text-text-muted mb-1">🌍 CO₂ Saved</p>
                    <p className="text-2xl font-bold text-accent-green">{totalCO2Saved.toFixed(1)} kg</p>
                    <p className="text-xs text-text-muted mt-1">@ 0.8 kg/kWh</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-text-primary">{formatUSD(totalSpent)}</p>
                    <p className="text-xs text-text-muted mt-1">{purchases.length} purchases</p>
                </div>
            </div>

            {/* Projects */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <h3 className="section-title">Available Projects</h3>
                    {/* Energy type filter */}
                    <div className="flex gap-2 text-sm">
                        {(['all', 'solar', 'wind', 'biogas'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${filter === f ? 'bg-accent-green text-white' : 'bg-surface-hover text-text-muted hover:text-text-primary'}`}>
                                {f === 'all' ? 'All' : `${ENERGY_ICONS[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
                            </button>
                        ))}
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-text-muted">No {filter === 'all' ? '' : filter} projects available right now.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map(project => (
                            <div key={project.id} className="bg-surface-hover rounded-xl p-5 flex flex-col gap-4 border border-transparent hover:border-accent-green/25 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ENERGY_COLORS[project.energy_type]}`}>
                                            {ENERGY_ICONS[project.energy_type]} {project.energy_type.charAt(0).toUpperCase() + project.energy_type.slice(1)}
                                        </span>
                                        {project.location && <p className="text-xs text-text-muted mt-1.5">📍 {project.location}</p>}
                                        {/* Seller badge */}
                                        {project.seller?.username && (
                                            <p className="text-xs text-text-muted mt-1">
                                                🏭 <span className="text-text-primary font-medium">{project.seller.username}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-lg font-bold text-accent-green">{formatUSD(project.price_per_kwh)}</p>
                                        <p className="text-xs text-text-muted">per kWh</p>
                                    </div>
                                </div>

                                {project.description && (
                                    <p className="text-sm text-text-muted line-clamp-2">{project.description}</p>
                                )}

                                <div className="flex items-end justify-between mt-auto pt-3 border-t border-border">
                                    <div>
                                        <p className="text-xs text-text-muted">Available</p>
                                        <p className="font-bold text-text-primary">{project.total_kwh.toFixed(0)} kWh</p>
                                        <p className="text-xs text-text-muted mt-0.5">
                                            ≈ {(project.total_kwh * CO2_PER_KWH).toFixed(0)} kg CO₂ savings
                                        </p>
                                    </div>
                                    <button onClick={() => openBuy(project)} className="btn-primary">
                                        Buy Energy
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Purchase History */}
            <div className="card p-5">
                <h3 className="section-title mb-5">Purchase History</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium">Type</th>
                                <th className="pb-3 font-medium">kWh</th>
                                <th className="pb-3 font-medium">CO₂ Saved</th>
                                <th className="pb-3 font-medium">Paid</th>
                                <th className="pb-3 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {purchases.map(p => (
                                <tr key={p.id} className="table-row-hover">
                                    <td className="py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[p.project?.energy_type ?? 'solar']}`}>
                                            {ENERGY_ICONS[p.project?.energy_type ?? 'solar']} {p.project?.energy_type ?? '—'}
                                        </span>
                                    </td>
                                    <td className="py-3 font-semibold text-text-primary">{p.kwh_bought.toFixed(2)} kWh</td>
                                    <td className="py-3 text-accent-green font-medium">{(p.kwh_bought * CO2_PER_KWH).toFixed(2)} kg</td>
                                    <td className="py-3 text-text-primary">{formatUSD(p.total_price)}</td>
                                    <td className="py-3 text-text-muted">{formatDate(p.created_at)}</td>
                                </tr>
                            ))}
                            {purchases.length === 0 && (
                                <tr><td colSpan={5} className="py-8 text-center text-text-muted">No purchases yet. Buy your first kWh above!</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Buy Modal */}
            <Modal open={buyModal} onClose={() => { setBuyModal(false); setSuccessMsg(''); }} title={`Buy Energy — ${selectedProject ? ENERGY_ICONS[selectedProject.energy_type] + ' ' + selectedProject.energy_type : ''}`}>
                {successMsg ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">
                            {successMsg}
                        </div>
                        <button onClick={() => { setBuyModal(false); setSuccessMsg(''); }} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleBuy} className="space-y-4">
                        {/* Project info */}
                        <div className="p-4 bg-surface-hover rounded-xl text-sm space-y-1.5">
                            {selectedProject?.seller?.username && (
                                <div className="flex justify-between pb-1.5 mb-1 border-b border-border">
                                    <span className="text-text-muted">Seller</span>
                                    <span className="font-semibold text-text-primary">🏭 {selectedProject.seller.username}</span>
                                </div>
                            )}
                            <div className="flex justify-between"><span className="text-text-muted">Price/kWh</span><span className="text-accent-green font-bold">{formatUSD(selectedProject?.price_per_kwh ?? 0)}</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Available</span><span className="text-text-primary">{selectedProject?.total_kwh.toFixed(0)} kWh</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Your wallet</span><span className="text-text-primary">{formatUSD(walletBalance)}</span></div>
                        </div>

                        {buyError && <p className="text-sm text-danger">{buyError}</p>}

                        <div>
                            <label className="input-label">kWh to Purchase</label>
                            <input type="number" min="0.01" step="0.01" required
                                max={selectedProject?.total_kwh}
                                value={kwh} onChange={e => setKwh(e.target.value)}
                                className="input" placeholder="e.g. 50" />
                        </div>

                        {kwhNum > 0 && selectedProject && (
                            <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm space-y-1">
                                <div className="flex justify-between"><span className="text-text-muted">Estimated Cost</span><span className="font-bold text-accent-green">{formatUSD(estCost)}</span></div>
                                <div className="flex justify-between"><span className="text-text-muted">CO₂ Saved</span><span className="font-medium text-accent-green">{(kwhNum * CO2_PER_KWH).toFixed(2)} kg 🌍</span></div>
                                <div className="flex justify-between"><span className="text-text-muted">Balance After</span>
                                    <span className={`font-medium ${walletBalance - estCost < 0 ? 'text-danger' : 'text-text-primary'}`}>
                                        {formatUSD(walletBalance - estCost)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button type="button" onClick={() => setBuyModal(false)} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={buying} className="btn-primary flex-1 disabled:opacity-60">
                                {buying ? 'Processing…' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
