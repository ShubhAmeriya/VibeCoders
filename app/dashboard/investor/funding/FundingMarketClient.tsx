'use client';

// =============================================================
// /app/dashboard/investor/funding/FundingMarketClient.tsx
//
// Tabs:
//   🌱 Fund Projects — cards with invest button (wallet-backed)
//   📊 My Investments — table of past investments
//
// Invest flow:
//   1. Check wallet balance (profile.wallet_balance_inr OR wallet_balance_usd)
//   2. Call invest_in_funding RPC (atomically deducts wallet + adds to funding)
//   3. router.refresh() on success
// =============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { createClient } from '@/lib/supabaseClient';
import { formatDate } from '@/utils/formatters';
import type { Profile } from '@/types';
import type { FundingRequest, FundingInvestmentRow } from './page';

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};
const ORG_COLORS: Record<string, string> = {
    government: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    private: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

function formatINR(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type Tab = 'projects' | 'investments';

interface Props {
    profile: Profile;
    walletBalanceInr: number;
    fundingRequests: FundingRequest[];
    myInvestments: FundingInvestmentRow[];
}

export function FundingMarketClient({ profile, walletBalanceInr, fundingRequests, myInvestments }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('projects');

    // Live wallet balance (updated after each investment)
    const [walletBalance, setWalletBalance] = useState(walletBalanceInr);

    // Invest modal state
    const [selectedFunding, setSelectedFunding] = useState<FundingRequest | null>(null);
    const [amountStr, setAmountStr] = useState('');
    const [investing, setInvesting] = useState(false);
    const [investError, setInvestError] = useState('');
    const [investSuccess, setInvestSuccess] = useState('');

    const totalInvested = myInvestments.reduce((s, i) => s + i.amount_invested_inr, 0);
    const openProjects = fundingRequests.filter(r => (r.funds_raised_inr ?? 0) < (r.funding_goal_inr ?? 0)).length;

    async function handleInvest(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedFunding) return;

        const amount = parseFloat(amountStr);
        if (!amount || amount <= 0) { setInvestError('Enter a valid investment amount.'); return; }

        // Client-side wallet check
        if (amount > walletBalance) {
            setInvestError(`Insufficient wallet balance. You have ${formatINR(walletBalance)} available.`);
            return;
        }

        const remaining = selectedFunding.funding_goal_inr - (selectedFunding.funds_raised_inr ?? 0);
        if (amount > remaining) {
            setInvestError(`Only ${formatINR(remaining)} remaining to reach this goal.`);
            return;
        }

        setInvesting(true);
        setInvestError('');

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInvestError('Session expired. Please reload.'); setInvesting(false); return; }

        // RPC atomically: inserts investment + increments funds_raised_inr + deducts wallet
        const { error } = await supabase.rpc('invest_in_funding', {
            p_investor_id: user.id,
            p_funding_id: selectedFunding.id,
            p_amount_inr: amount,
        });

        setInvesting(false);

        if (error) {
            console.error('[FundingMarket] invest_in_funding error:', error);
            setInvestError(error.message ?? 'Investment failed. Please try again.');
            return;
        }

        // Optimistically update wallet balance shown in UI
        setWalletBalance(prev => prev - amount);
        setInvestSuccess(`✅ Successfully invested ${formatINR(amount)} in ${selectedFunding.organization_name}!`);
        setAmountStr('');
        router.refresh();
    }

    function closeModal() {
        setSelectedFunding(null);
        setAmountStr('');
        setInvestError('');
        setInvestSuccess('');
    }

    const selectedRemaining = selectedFunding
        ? selectedFunding.funding_goal_inr - (selectedFunding.funds_raised_inr ?? 0)
        : 0;
    const amtNum = parseFloat(amountStr);
    const insufficientBalance = amtNum > 0 && amtNum > walletBalance;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">💰 Funding Marketplace</h1>
                    <p className="text-text-muted mt-1">
                        Welcome back, <span className="text-text-primary font-medium">{profile.username}</span>
                    </p>
                </div>
                {/* Wallet balance chip */}
                <div className="card px-4 py-2.5 text-sm border border-accent-green/20">
                    <span className="text-text-muted">Wallet: </span>
                    <span className="text-accent-green font-bold">{formatINR(walletBalance)}</span>
                </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Invested</p>
                    <p className="text-2xl font-bold text-accent-green">{formatINR(totalInvested)}</p>
                    <p className="text-xs text-text-muted mt-1">{myInvestments.length} investment{myInvestments.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Open Projects</p>
                    <p className="text-2xl font-bold text-accent-blue">{openProjects}</p>
                    <p className="text-xs text-text-muted mt-1">Still seeking funding</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Wallet Balance</p>
                    <p className="text-2xl font-bold text-text-primary">{formatINR(walletBalance)}</p>
                    <p className="text-xs text-text-muted mt-1">Available to invest</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {([
                    ['projects', '🌱 Fund Projects'],
                    ['investments', '📊 My Investments'],
                ] as [Tab, string][]).map(([tab, label]) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab
                                ? 'border-accent-green text-accent-green'
                                : 'border-transparent text-text-muted hover:text-text-primary'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ══ FUND PROJECTS TAB ══ */}
            {activeTab === 'projects' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="section-title">Energy Projects Seeking Funding</h2>
                        <p className="text-xs text-text-muted mt-0.5">
                            {fundingRequests.length} project{fundingRequests.length !== 1 ? 's' : ''} available · invest from wallet balance
                        </p>
                    </div>

                    {fundingRequests.length === 0 ? (
                        <div className="card py-14 text-center">
                            <p className="text-3xl mb-2">🌱</p>
                            <p className="text-text-primary font-semibold">No funding requests yet</p>
                            <p className="text-xs text-text-muted mt-1">Sellers will create funding requests from their Energy Projects page.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {fundingRequests.map((req) => {
                                const raised = req.funds_raised_inr ?? 0;
                                const goal = req.funding_goal_inr ?? 0;
                                const pct = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
                                const remaining = goal - raised;
                                const isFull = remaining <= 0;
                                const energyType = req.project?.energy_type ?? '';

                                return (
                                    <div key={req.id} className="card p-5 space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {energyType && (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${ENERGY_COLORS[energyType] ?? 'border-border text-text-muted'}`}>
                                                            {ENERGY_ICONS[energyType] ?? '🔋'} {energyType.charAt(0).toUpperCase() + energyType.slice(1)}
                                                        </span>
                                                    )}
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ORG_COLORS[req.organization_type] ?? 'border-border text-text-muted'}`}>
                                                        {req.organization_type.charAt(0).toUpperCase() + req.organization_type.slice(1)}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-semibold text-text-primary">{req.organization_name}</p>
                                                {req.project?.location && <p className="text-xs text-text-muted">📍 {req.project.location}</p>}
                                                <p className="text-xs text-text-muted">🏭 <span className="text-text-primary font-medium">{req.seller?.username ?? 'Seller'}</span></p>
                                            </div>
                                            {isFull ? (
                                                <span className="text-xs px-2 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20 font-semibold flex-shrink-0">Fully Funded ✓</span>
                                            ) : (
                                                <button
                                                    onClick={() => { setSelectedFunding(req); setInvestError(''); setInvestSuccess(''); }}
                                                    className="btn-primary flex-shrink-0"
                                                >
                                                    Invest
                                                </button>
                                            )}
                                        </div>

                                        {req.project?.description && (
                                            <p className="text-xs text-text-muted line-clamp-2">{req.project.description}</p>
                                        )}

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-text-muted">
                                                <span>Raised: <span className="text-accent-green font-semibold">{formatINR(raised)}</span></span>
                                                <span>Goal: <span className="text-text-primary font-semibold">{formatINR(goal)}</span></span>
                                            </div>
                                            <div className="h-2 bg-border rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${isFull ? 'bg-accent-green' : 'bg-accent-blue'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-accent-blue font-semibold">{pct.toFixed(1)}% funded</span>
                                                {!isFull && <span className="text-text-muted">{formatINR(remaining)} remaining</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══ MY INVESTMENTS TAB ══ */}
            {activeTab === 'investments' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="section-title">My Investment History</h2>
                        <p className="text-xs text-text-muted mt-0.5">{myInvestments.length} total investment{myInvestments.length !== 1 ? 's' : ''}</p>
                    </div>

                    {myInvestments.length > 0 && (
                        <div className="card p-5 border border-accent-green/20 bg-accent-green/5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-text-muted">Total Invested</p>
                                <p className="text-2xl font-bold text-accent-green">{formatINR(totalInvested)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-text-muted">Across</p>
                                <p className="text-lg font-bold text-text-primary">{myInvestments.length} deal{myInvestments.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}

                    <div className="card p-5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-text-muted text-left">
                                        <th className="pb-3 font-medium pr-4">Organization</th>
                                        <th className="pb-3 font-medium pr-4">Energy Type</th>
                                        <th className="pb-3 font-medium pr-4">Amount Invested</th>
                                        <th className="pb-3 font-medium pr-4">Funding Goal</th>
                                        <th className="pb-3 font-medium pr-4">Funds Raised</th>
                                        <th className="pb-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {myInvestments.map((inv) => {
                                        const energyType = inv.funding?.project?.energy_type ?? null;
                                        const goal = inv.funding?.funding_goal_inr ?? 0;
                                        const raised = inv.funding?.funds_raised_inr ?? 0;
                                        return (
                                            <tr key={inv.id} className="table-row-hover">
                                                <td className="py-3 pr-4 text-text-primary font-medium">{inv.funding?.organization_name ?? '—'}</td>
                                                <td className="py-3 pr-4">
                                                    {energyType ? (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[energyType] ?? ''}`}>
                                                            {ENERGY_ICONS[energyType] ?? ''} {energyType.charAt(0).toUpperCase() + energyType.slice(1)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-accent-green font-bold">{formatINR(inv.amount_invested_inr)}</td>
                                                <td className="py-3 pr-4 text-text-primary">{goal > 0 ? formatINR(goal) : '—'}</td>
                                                <td className="py-3 pr-4 text-text-primary">{goal > 0 ? formatINR(raised) : '—'}</td>
                                                <td className="py-3 text-text-muted whitespace-nowrap">{formatDate(inv.created_at)}</td>
                                            </tr>
                                        );
                                    })}
                                    {myInvestments.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-text-muted">
                                                No investments yet.{' '}
                                                <button onClick={() => setActiveTab('projects')} className="text-accent-green hover:underline">Browse projects →</button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ INVEST MODAL ══ */}
            <Modal
                open={!!selectedFunding}
                onClose={closeModal}
                title={selectedFunding ? `Invest in ${selectedFunding.organization_name}` : ''}
            >
                {investSuccess ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">{investSuccess}</div>
                        <button onClick={closeModal} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleInvest} className="space-y-4">
                        {/* Wallet balance */}
                        <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl flex justify-between text-sm">
                            <span className="text-text-muted">Your Wallet Balance</span>
                            <span className="font-bold text-accent-green">{formatINR(walletBalance)}</span>
                        </div>

                        {/* Project summary */}
                        <div className="p-4 bg-surface-hover rounded-xl text-sm space-y-2">
                            {selectedFunding?.seller?.username && (
                                <div className="flex justify-between pb-2 mb-1 border-b border-border">
                                    <span className="text-text-muted">Seller</span>
                                    <span className="font-semibold text-text-primary">🏭 {selectedFunding.seller.username}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-text-muted">Organization</span>
                                <span className="font-semibold text-text-primary">{selectedFunding?.organization_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Funding Goal</span>
                                <span className="font-semibold text-text-primary">{selectedFunding ? formatINR(selectedFunding.funding_goal_inr) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Already Raised</span>
                                <span className="font-semibold text-accent-green">{selectedFunding ? formatINR(selectedFunding.funds_raised_inr ?? 0) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Still Needed</span>
                                <span className="font-semibold text-accent-blue">{formatINR(selectedRemaining)}</span>
                            </div>
                        </div>

                        {investError && <p className="text-sm text-danger">{investError}</p>}

                        <div>
                            <label className="input-label">Amount to Invest (₹ INR)</label>
                            <input
                                type="number" min="1" step="1" required
                                max={Math.min(selectedRemaining, walletBalance)}
                                value={amountStr}
                                onChange={(e) => setAmountStr(e.target.value)}
                                className={`input ${insufficientBalance ? 'border-danger' : ''}`}
                                placeholder="e.g. 5000"
                            />
                            {insufficientBalance && (
                                <p className="text-xs text-danger mt-1">Amount exceeds wallet balance ({formatINR(walletBalance)})</p>
                            )}
                        </div>

                        {amtNum > 0 && !insufficientBalance && selectedFunding && (
                            <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Your investment</span>
                                    <span className="font-bold text-accent-green">{formatINR(amtNum)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-text-muted">
                                    <span>Wallet after</span>
                                    <span className="text-text-primary">{formatINR(walletBalance - amtNum)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-text-muted">
                                    <span>New raised total</span>
                                    <span className="text-text-primary">{formatINR((selectedFunding.funds_raised_inr ?? 0) + amtNum)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={investing || insufficientBalance} className="btn-primary flex-1 disabled:opacity-60">
                                {investing ? 'Processing…' : 'Confirm Investment'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
