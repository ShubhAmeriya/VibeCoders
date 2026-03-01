'use client';

// =============================================================
// /app/dashboard/investor/InvestorDashboardClient.tsx
//
// Two sections:
//  1. 🌱 Fund Projects  — energy_projects with progress bars + invest modal
//  2. 💼 Portfolio      — investor's funded projects (joined with funding_requests)
//
// All values in INR. API call → /api/invest
// After invest: router.refresh() updates both sections.
// =============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { formatDate } from '@/utils/formatters';
import { InvestorPDFButton } from '@/components/PDFButtons';
import type { Profile } from '@/types';
import type { FundingProject, InvestmentRow } from '@/app/dashboard/investor/page';

function formatINR(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

type Tab = 'projects' | 'portfolio';

interface Props {
    profile: Profile;
    fundingProjects: FundingProject[];
    investments: InvestmentRow[];
}

export function InvestorDashboardClient({ profile, fundingProjects, investments }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('projects');

    // Invest modal
    const [selectedProject, setSelectedProject] = useState<FundingProject | null>(null);
    const [amountInr, setAmountInr] = useState('');
    const [investing, setInvesting] = useState(false);
    const [investError, setInvestError] = useState('');
    const [investSuccess, setInvestSuccess] = useState('');

    // ── Derived metrics ──────────────────────────────────────────
    const totalInvested = investments.reduce((s, i) => s + i.amount_invested_inr, 0);
    const uniqueOrgs = new Set(investments.map((i) => i.funding_request?.organization_name)).size;
    const walletBalance = profile.wallet_balance_usd ?? 0;

    // ── Invest handler ───────────────────────────────────────────
    async function handleInvest(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        const amt = parseFloat(amountInr);
        if (!amt || amt <= 0) { setInvestError('Enter a valid amount.'); return; }

        const remaining = selectedProject.funding_goal_inr - selectedProject.funds_raised_inr;
        if (amt > remaining) {
            setInvestError(`Only ₹${remaining.toLocaleString('en-IN')} remaining to reach the goal.`);
            return;
        }

        // Client-side wallet check (server also checks)
        if (amt > walletBalance) {
            setInvestError(`Insufficient wallet balance. You have ${formatINR(walletBalance)} but need ${formatINR(amt)}.`);
            return;
        }

        setInvesting(true); setInvestError('');

        const res = await fetch('/api/invest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: selectedProject.id, amountInr: amt }),
        });
        const data = await res.json();
        setInvesting(false);

        if (!res.ok || data.error) {
            setInvestError(data.error ?? 'Investment failed. Please try again.');
            return;
        }

        setInvestSuccess(`✅ Successfully invested ${formatINR(amt)} in this project!`);
        setAmountInr('');
        router.refresh();
    }

    function closeModal() {
        setSelectedProject(null);
        setInvestSuccess('');
        setInvestError('');
        setAmountInr('');
    }

    const amtNum = parseFloat(amountInr);
    const selectedRemaining = selectedProject
        ? selectedProject.funding_goal_inr - selectedProject.funds_raised_inr
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Investor Dashboard</h1>
                    <p className="text-text-muted mt-1">
                        Welcome back, <span className="text-text-primary font-medium">{profile.username}</span>
                    </p>
                </div>
                <div className="card px-4 py-2 text-sm">
                    <span className="text-text-muted">Wallet: </span>
                    <span className="text-accent-green font-bold">{formatINR(walletBalance)}</span>
                </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Invested</p>
                    <p className="text-2xl font-bold text-accent-green">{formatINR(totalInvested)}</p>
                    <p className="text-xs text-text-muted mt-1">{investments.length} investment{investments.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Projects Funded</p>
                    <p className="text-2xl font-bold text-accent-blue">{uniqueOrgs}</p>
                    <p className="text-xs text-text-muted mt-1">Unique organizations</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Open Projects</p>
                    <p className="text-2xl font-bold text-text-primary">
                        {fundingProjects.filter((p) => p.funds_raised_inr < p.funding_goal_inr).length}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Still seeking funding</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {([
                    ['projects', '🌱 Fund Projects'],
                    ['portfolio', '💼 Portfolio'],
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

            {/* ══ 🌱 FUND PROJECTS TAB ══════════════════════════════ */}
            {activeTab === 'projects' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="section-title">Energy Projects Seeking Funding</h2>
                        <p className="text-xs text-text-muted mt-0.5">{fundingProjects.length} project{fundingProjects.length !== 1 ? 's' : ''} available</p>
                    </div>

                    {/* Wallet balance notice */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm">
                        <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                        <span className="text-text-muted">Investments are deducted from your wallet balance:</span>
                        <span className="text-accent-green font-bold">{formatINR(walletBalance)}</span>
                    </div>

                    {fundingProjects.length === 0 ? (
                        <div className="card py-14 text-center">
                            <p className="text-3xl mb-2">🌱</p>
                            <p className="text-text-primary font-semibold">No projects seeking funding yet</p>
                            <p className="text-xs text-text-muted mt-1">Sellers must set a Funding Goal (₹) when creating a project.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {fundingProjects.map((project) => {
                                const raised = project.funds_raised_inr ?? 0;
                                const goal = project.funding_goal_inr ?? 0;
                                const pct = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
                                const remaining = goal - raised;
                                const isFull = remaining <= 0;

                                return (
                                    <div key={project.id} className="card p-5 space-y-4">
                                        {/* Top row */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ENERGY_COLORS[project.energy_type]}`}>
                                                    {ENERGY_ICONS[project.energy_type]} {project.energy_type.charAt(0).toUpperCase() + project.energy_type.slice(1)}
                                                </span>
                                                {project.location && (
                                                    <p className="text-xs text-text-muted">📍 {project.location}</p>
                                                )}
                                                <p className="text-xs text-text-muted">
                                                    🏭 <span className="text-text-primary font-medium">{project.owner?.username ?? 'Seller'}</span>
                                                </p>
                                            </div>
                                            {isFull ? (
                                                <span className="badge-green flex-shrink-0">Fully Funded</span>
                                            ) : (
                                                <button
                                                    onClick={() => { setSelectedProject(project); setInvestError(''); setInvestSuccess(''); }}
                                                    className="btn-primary flex-shrink-0"
                                                >
                                                    Invest
                                                </button>
                                            )}
                                        </div>

                                        {project.description && (
                                            <p className="text-xs text-text-muted line-clamp-2">{project.description}</p>
                                        )}

                                        {/* Funding stats */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-text-muted">
                                                <span>Raised: <span className="text-accent-green font-semibold">{formatINR(raised)}</span></span>
                                                <span>Goal: <span className="text-text-primary font-semibold">{formatINR(goal)}</span></span>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="h-2 bg-border rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${isFull ? 'bg-accent-green' : 'bg-accent-blue'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
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

            {/* ══ 💼 PORTFOLIO TAB ══════════════════════════════════ */}
            {activeTab === 'portfolio' && (
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="section-title">My Portfolio</h2>
                            <p className="text-xs text-text-muted mt-0.5">{investments.length} investment{investments.length !== 1 ? 's' : ''} across funded projects</p>
                        </div>
                        <InvestorPDFButton
                            username={profile.username}
                            investments={investments.map((inv) => ({
                                id: inv.id,
                                energyType: inv.project?.energy_type ?? null,
                                location: inv.project?.location ?? null,
                                amountInvested: inv.amount_invested_inr,
                                fundingGoal: inv.funding_request?.funding_goal_inr ?? inv.project?.funding_goal_inr ?? null,
                                fundsRaised: inv.funding_request?.funds_raised_inr ?? inv.project?.funds_raised_inr ?? null,
                                date: inv.created_at,
                            }))}
                        />
                    </div>

                    <div className="card p-5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-text-muted text-left">
                                        <th className="pb-3 font-medium pr-4">Organization</th>
                                        <th className="pb-3 font-medium pr-4">Energy Type</th>
                                        <th className="pb-3 font-medium pr-4">Amount Invested</th>
                                        <th className="pb-3 font-medium pr-4">Funding Progress</th>
                                        <th className="pb-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {investments.map((inv) => {
                                        const type = inv.project?.energy_type ?? null;
                                        const goal = inv.funding_request?.funding_goal_inr ?? inv.project?.funding_goal_inr ?? 0;
                                        const raised = inv.funding_request?.funds_raised_inr ?? inv.project?.funds_raised_inr ?? 0;
                                        const pct = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
                                        const orgName = inv.funding_request?.organization_name ?? inv.project?.energy_type ?? '—';
                                        return (
                                            <tr key={inv.id} className="table-row-hover">
                                                <td className="py-3 pr-4 text-text-primary font-medium">{orgName}</td>
                                                <td className="py-3 pr-4">
                                                    {type ? (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[type] ?? ''}`}>
                                                            {ENERGY_ICONS[type] ?? ''} {type.charAt(0).toUpperCase() + type.slice(1)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-accent-green font-bold">{formatINR(inv.amount_invested_inr)}</td>
                                                <td className="py-3 pr-4">
                                                    {goal > 0 ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                                                                    <div className="h-full bg-accent-green rounded-full" style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className="text-xs text-text-muted">{pct.toFixed(0)}%</span>
                                                            </div>
                                                            <p className="text-xs text-text-muted">{formatINR(raised)} / {formatINR(goal)}</p>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-3 text-text-muted whitespace-nowrap">{formatDate(inv.created_at)}</td>
                                            </tr>
                                        );
                                    })}
                                    {investments.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-text-muted">
                                                No investments yet.{' '}
                                                <button
                                                    onClick={() => setActiveTab('projects')}
                                                    className="text-accent-green hover:underline"
                                                >
                                                    Browse projects →
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ INVEST MODAL ══════════════════════════════════════ */}
            <Modal
                open={!!selectedProject}
                onClose={closeModal}
                title={selectedProject ? `Invest in ${ENERGY_ICONS[selectedProject.energy_type]} ${selectedProject.energy_type.charAt(0).toUpperCase() + selectedProject.energy_type.slice(1)} Project` : ''}
            >
                {investSuccess ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">
                            {investSuccess}
                        </div>
                        <button onClick={closeModal} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleInvest} className="space-y-4">
                        {/* Wallet balance warning */}
                        <div className="p-3 bg-surface-hover rounded-xl text-sm flex justify-between items-center">
                            <span className="text-text-muted">Your wallet balance</span>
                            <span className={`font-bold ${walletBalance <= 0 ? 'text-danger' : 'text-accent-green'}`}>
                                {formatINR(walletBalance)}
                            </span>
                        </div>

                        {/* Project funding summary */}
                        <div className="p-4 bg-surface-hover rounded-xl text-sm space-y-2">
                            {selectedProject?.owner?.username && (
                                <div className="flex justify-between pb-2 mb-1 border-b border-border">
                                    <span className="text-text-muted">Seller</span>
                                    <span className="font-semibold text-text-primary">🏭 {selectedProject.owner.username}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-text-muted">Funding Goal</span>
                                <span className="text-text-primary font-semibold">{selectedProject ? formatINR(selectedProject.funding_goal_inr) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Already Raised</span>
                                <span className="text-accent-green font-semibold">{selectedProject ? formatINR(selectedProject.funds_raised_inr) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Still Needed</span>
                                <span className="text-accent-blue font-semibold">{formatINR(selectedRemaining)}</span>
                            </div>
                            {/* Progress bar */}
                            {selectedProject && selectedProject.funding_goal_inr > 0 && (
                                <div className="pt-1">
                                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent-blue rounded-full"
                                            style={{ width: `${Math.min((selectedProject.funds_raised_inr / selectedProject.funding_goal_inr) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {investError && <p className="text-sm text-danger">{investError}</p>}

                        <div>
                            <label className="input-label">Amount to Invest (₹ INR)</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                max={Math.min(selectedRemaining, walletBalance)}
                                value={amountInr}
                                onChange={(e) => setAmountInr(e.target.value)}
                                className="input"
                                placeholder="e.g. 5000"
                            />
                            {walletBalance > 0 && (
                                <p className="text-xs text-text-muted mt-1">
                                    Max available: {formatINR(Math.min(selectedRemaining, walletBalance))}
                                </p>
                            )}
                        </div>

                        {amtNum > 0 && selectedProject && (
                            <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Your investment</span>
                                    <span className="font-bold text-accent-green">{formatINR(amtNum)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-text-muted">
                                    <span>Wallet after investment</span>
                                    <span className={amtNum > walletBalance ? 'text-danger' : 'text-text-primary'}>
                                        {formatINR(walletBalance - amtNum)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-text-muted">
                                    <span>New raised total</span>
                                    <span className="text-text-primary">{formatINR(selectedProject.funds_raised_inr + amtNum)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                            <button
                                type="submit"
                                disabled={investing || walletBalance <= 0}
                                className="btn-primary flex-1 disabled:opacity-60"
                            >
                                {investing ? 'Processing…' : walletBalance <= 0 ? 'Insufficient Balance' : 'Confirm Investment'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
