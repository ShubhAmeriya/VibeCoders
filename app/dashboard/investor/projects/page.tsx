import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, Project, Investment } from '@/types';
import { formatUSD, formatDate, calcFundedPercent } from '@/utils/formatters';

export default async function InvestorProjectsPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'investor') redirect('/dashboard');

    const { data: projects } = await supabase
        .from('projects').select('*').order('created_at', { ascending: false }).returns<Project[]>();

    const { data: myInvestments } = await supabase
        .from('investments').select('project_id, amount').eq('user_id', user.id).returns<Pick<Investment, 'project_id' | 'amount'>[]>();

    const myInvestedIds = new Set((myInvestments ?? []).map(i => i.project_id));
    const myTotalByProject: Record<string, number> = {};
    (myInvestments ?? []).forEach(i => { myTotalByProject[i.project_id] = (myTotalByProject[i.project_id] ?? 0) + i.amount; });

    const riskColors: Record<string, string> = { low: 'badge-green', medium: 'badge-warning', high: 'badge-danger' };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Investment Projects</h1>
                <p className="text-text-muted mt-1">Browse and invest in curated opportunities</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Projects</p>
                    <p className="text-2xl font-bold text-text-primary">{projects?.length ?? 0}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">You&apos;re Invested In</p>
                    <p className="text-2xl font-bold text-accent-green">{myInvestedIds.size}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Wallet Balance</p>
                    <p className="text-2xl font-bold text-text-primary">{formatUSD(profile.wallet_balance_usd)}</p>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(projects ?? []).map((project) => {
                    const pct = calcFundedPercent(project.funded_amount, project.funding_goal);
                    const alreadyInvested = myInvestedIds.has(project.id);
                    return (
                        <div key={project.id} className="card p-6 flex flex-col gap-4 hover:border-accent-blue/30 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-text-primary">{project.name}</h3>
                                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{project.description}</p>
                                </div>
                                <span className={riskColors[project.risk_level]}>{project.risk_level}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="bg-surface-hover rounded-xl p-3 text-center">
                                    <p className="text-text-muted text-xs mb-0.5">ROI</p>
                                    <p className="text-accent-green font-bold">{project.expected_roi}%</p>
                                </div>
                                <div className="bg-surface-hover rounded-xl p-3 text-center">
                                    <p className="text-text-muted text-xs mb-0.5">Duration</p>
                                    <p className="text-text-primary font-semibold">{project.duration_days}d</p>
                                </div>
                                <div className="bg-surface-hover rounded-xl p-3 text-center">
                                    <p className="text-text-muted text-xs mb-0.5">Goal</p>
                                    <p className="text-text-primary font-semibold text-xs">{formatUSD(project.funding_goal)}</p>
                                </div>
                            </div>

                            {/* Funding progress */}
                            <div>
                                <div className="flex justify-between text-xs text-text-muted mb-1.5">
                                    <span>{formatUSD(project.funded_amount)} raised</span>
                                    <span>{pct.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-border rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-green rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                {alreadyInvested && (
                                    <span className="text-xs text-accent-green">
                                        ✓ You invested {formatUSD(myTotalByProject[project.id] ?? 0)}
                                    </span>
                                )}
                                <a
                                    href={`/dashboard/investor?invest=${project.id}`}
                                    className="btn-primary ml-auto text-sm"
                                >
                                    {alreadyInvested ? 'Invest More' : 'Invest Now'}
                                </a>
                            </div>
                            <p className="text-xs text-text-muted">Listed {formatDate(project.created_at)}</p>
                        </div>
                    );
                })}
                {(projects ?? []).length === 0 && (
                    <div className="col-span-2 card p-12 text-center text-text-muted">No projects available yet</div>
                )}
            </div>
        </div>
    );
}
