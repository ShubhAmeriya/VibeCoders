// =============================================================
// /app/dashboard/investor/portfolio/page.tsx — Server Component
// Replaces the old "Projects" tab.
// Shows the investor's funding-backed portfolio using:
//   investments → funding_requests → energy_projects
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile } from '@/types';
import { formatDate } from '@/utils/formatters';

type PortfolioRow = {
    id: string;
    amount_invested_inr: number;
    created_at: string;
    funding: {
        organization_name: string;
        funding_goal_inr: number;
        funds_raised_inr: number;
        project: {
            energy_type: string;
            location: string | null;
        } | null;
    } | null;
};

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

function formatINR(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function InvestorPortfolioPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'investor') redirect('/dashboard');

    // Join: investments → funding_requests → energy_projects
    const { data: rawRows, error } = await supabase
        .from('investments')
        .select(`
            id,
            amount_invested_inr,
            created_at,
            funding:funding_requests (
                organization_name,
                funding_goal_inr,
                funds_raised_inr,
                project:energy_projects (
                    energy_type,
                    location
                )
            )
        `)
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false });

    if (error) console.error('[Portfolio] investments error:', error);
    const rows = (rawRows ?? []) as unknown as PortfolioRow[];

    const totalInvested = rows.reduce((s, r) => s + r.amount_invested_inr, 0);
    const uniqueOrgs = new Set(rows.map(r => r.funding?.organization_name).filter(Boolean)).size;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">📊 Portfolio</h1>
                <p className="text-text-muted mt-1">Your funding investments — all from Supabase</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Invested</p>
                    <p className="text-2xl font-bold text-accent-green">{formatINR(totalInvested)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Deals</p>
                    <p className="text-2xl font-bold text-text-primary">{rows.length}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Organizations</p>
                    <p className="text-2xl font-bold text-accent-blue">{uniqueOrgs}</p>
                </div>
            </div>

            {/* Portfolio Table */}
            <div className="card p-5">
                <h2 className="section-title mb-5">Investment History</h2>
                {rows.length === 0 ? (
                    <div className="py-14 text-center">
                        <p className="text-3xl mb-2">📊</p>
                        <p className="text-text-primary font-semibold">No investments yet</p>
                        <p className="text-xs text-text-muted mt-1">
                            Go to the{' '}
                            <a href="/dashboard/investor/funding" className="text-accent-green hover:underline">Funding Marketplace</a>
                            {' '}to start investing.
                        </p>
                    </div>
                ) : (
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
                                {rows.map((row) => {
                                    const energyType = row.funding?.project?.energy_type ?? null;
                                    const goal = row.funding?.funding_goal_inr ?? 0;
                                    const raised = row.funding?.funds_raised_inr ?? 0;
                                    const pct = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
                                    return (
                                        <tr key={row.id} className="table-row-hover">
                                            <td className="py-3 pr-4">
                                                <p className="text-text-primary font-semibold">{row.funding?.organization_name ?? '—'}</p>
                                                {row.funding?.project?.location && (
                                                    <p className="text-xs text-text-muted">📍 {row.funding.project.location}</p>
                                                )}
                                            </td>
                                            <td className="py-3 pr-4">
                                                {energyType ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ENERGY_COLORS[energyType] ?? ''}`}>
                                                        {ENERGY_ICONS[energyType] ?? ''} {energyType.charAt(0).toUpperCase() + energyType.slice(1)}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="py-3 pr-4 text-accent-green font-bold">{formatINR(row.amount_invested_inr)}</td>
                                            <td className="py-4 pr-4 w-40">
                                                {goal > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${pct >= 100 ? 'bg-accent-green' : 'bg-accent-blue'}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-text-muted">{pct.toFixed(1)}% · {formatINR(raised)} / {formatINR(goal)}</p>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td className="py-3 text-text-muted whitespace-nowrap">{formatDate(row.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
