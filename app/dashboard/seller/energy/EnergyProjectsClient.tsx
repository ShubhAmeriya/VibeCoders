'use client';

// =============================================================
// /app/dashboard/seller/energy/EnergyProjectsClient.tsx
// Seller: manage energy projects + view funding progress + raise funds
// =============================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { StatCard } from '@/components/StatCard';
import { createClient } from '@/lib/supabaseClient';
import { formatUSD, formatDate } from '@/utils/formatters';
import type { Profile, EnergyProject } from '@/types';
import type { SellerPurchaseRow } from '@/app/dashboard/seller/energy/page';

const ENERGY_ICONS: Record<string, string> = { solar: '☀️', wind: '🌬️', biogas: '🌿' };
const ENERGY_COLORS: Record<string, string> = {
    solar: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    wind: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    biogas: 'bg-green-500/10 text-green-400 border-green-500/20',
};

function formatINR(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
    profile: Profile;
    projects: EnergyProject[];
    purchases: SellerPurchaseRow[];
}

const EMPTY_CREATE_FORM = {
    energy_type: 'solar' as 'solar' | 'wind' | 'biogas',
    total_kwh: '',
    price_per_kwh: '',
    location: '',
    description: '',
    funding_goal_inr: '',
};

const EMPTY_RAISE_FORM = {
    organization_name: '',
    organization_email: '',
    organization_type: 'private' as 'government' | 'private',
    funding_goal_inr: '',
};

export function EnergyProjectsClient({ profile, projects: initialProjects, purchases }: Props) {
    const router = useRouter();

    // ── Create project modal ─────────────────────────────────────
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');

    // ── Raise Funds modal ────────────────────────────────────────
    const [raiseFundsProject, setRaiseFundsProject] = useState<EnergyProject | null>(null);
    const [raiseForm, setRaiseForm] = useState(EMPTY_RAISE_FORM);
    const [raising, setRaising] = useState(false);
    const [raiseError, setRaiseError] = useState('');
    const [raiseSuccess, setRaiseSuccess] = useState('');

    // Live project list (polled every 8 s for funding updates)
    const [projects, setProjects] = useState<EnergyProject[]>(initialProjects);

    useEffect(() => {
        const supabase = createClient();
        async function refresh() {
            const { data } = await supabase
                .from('energy_projects')
                .select('id, total_kwh, funding_goal_inr, funds_raised_inr')
                .eq('owner_id', profile.id);
            if (data && data.length > 0) {
                setProjects(prev =>
                    prev.map(p => {
                        const fresh = data.find(d => d.id === p.id);
                        return fresh
                            ? { ...p, total_kwh: fresh.total_kwh, funding_goal_inr: fresh.funding_goal_inr ?? null, funds_raised_inr: fresh.funds_raised_inr ?? null }
                            : p;
                    })
                );
            }
        }
        const interval = setInterval(refresh, 8000);
        return () => clearInterval(interval);
    }, [profile.id]);

    const totalKwh = projects.reduce((s, p) => s + p.total_kwh, 0);
    const totalEarnings = purchases.reduce((s, p) => s + p.total_price, 0);
    const totalKwhSold = purchases.reduce((s, p) => s + p.kwh_bought, 0);

    // ── Create Project handler ────────────────────────────────────
    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreateError('');
        setCreateSuccess('');
        const kwh = Number(createForm.total_kwh);
        const price = Number(createForm.price_per_kwh);
        if (!kwh || kwh <= 0) { setCreateError('Total kWh must be a positive number.'); return; }
        if (!price || price <= 0) { setCreateError('Price per kWh must be a positive number.'); return; }
        const fundingGoal = createForm.funding_goal_inr ? Number(createForm.funding_goal_inr) : null;
        if (fundingGoal !== null && (isNaN(fundingGoal) || fundingGoal < 0)) {
            setCreateError('Funding goal must be a positive number.'); return;
        }
        setCreating(true);
        const supabase = createClient();
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData?.user) {
            setCreateError('You must be logged in to create a project.');
            setCreating(false); return;
        }
        const { error } = await supabase.from('energy_projects').insert({
            owner_id: userData.user.id,
            energy_type: createForm.energy_type,
            total_kwh: kwh,
            price_per_kwh: price,
            location: createForm.location || null,
            description: createForm.description || null,
            ...(fundingGoal !== null ? { funding_goal_inr: fundingGoal, funds_raised_inr: 0 } : {}),
        });
        setCreating(false);
        if (error) { setCreateError(error.message); return; }
        setCreateSuccess('✅ Project created successfully!');
        setCreateForm(EMPTY_CREATE_FORM);
        router.refresh();
    }

    // ── Raise Funds handler ───────────────────────────────────────
    async function handleRaiseFunds(e: React.FormEvent) {
        e.preventDefault();
        setRaiseError('');
        setRaiseSuccess('');
        if (!raiseFundsProject) return;
        if (!raiseForm.organization_name.trim()) { setRaiseError('Organization name is required.'); return; }
        const fundingGoal = Number(raiseForm.funding_goal_inr);
        if (!fundingGoal || fundingGoal <= 0) { setRaiseError('Funding goal must be a positive number.'); return; }

        setRaising(true);
        const supabase = createClient();
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData?.user) {
            setRaiseError('Session expired. Please reload.');
            setRaising(false); return;
        }

        const { error } = await supabase.from('funding_requests').insert({
            project_id: raiseFundsProject.id,
            seller_id: userData.user.id,
            organization_name: raiseForm.organization_name.trim(),
            organization_email: raiseForm.organization_email.trim() || userData.user.email,
            organization_type: raiseForm.organization_type,
            funding_goal_inr: fundingGoal,
        });

        setRaising(false);
        if (error) {
            console.error('[RaiseFunds] insert error:', error);
            setRaiseError(error.message);
            return;
        }
        setRaiseSuccess(`✅ Funding request created for ${raiseForm.organization_name}! Investors can now find and fund this project.`);
        setRaiseForm(EMPTY_RAISE_FORM);
        router.refresh();
    }

    function closeCreateModal() {
        setShowCreate(false);
        setCreateError('');
        setCreateSuccess('');
        setCreateForm(EMPTY_CREATE_FORM);
    }

    function closeRaiseModal() {
        setRaiseFundsProject(null);
        setRaiseError('');
        setRaiseSuccess('');
        setRaiseForm(EMPTY_RAISE_FORM);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">⚡ Energy Projects</h1>
                    <p className="text-text-muted mt-1">Manage your renewable energy listings &amp; raise investor funds</p>
                </div>
                <button onClick={() => { setShowCreate(true); setCreateError(''); }} className="btn-primary">
                    + New Project
                </button>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Projects" value={String(projects.length)} sub="Listed" accentColor="green" />
                <StatCard title="kWh Remaining" value={`${totalKwh.toFixed(0)} kWh`} sub="Available to sell" accentColor="blue" />
                <StatCard title="kWh Sold" value={`${totalKwhSold.toFixed(0)} kWh`} sub="All time" accentColor="neutral" />
                <StatCard title="Total Earnings" value={formatUSD(totalEarnings)} sub="From energy sales" accentColor="green" />
            </div>

            {/* Projects Grid */}
            <div className="card p-5">
                <h3 className="section-title mb-5">Your Listings</h3>
                {projects.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-4xl mb-3">🌱</p>
                        <p className="text-text-muted">No projects yet. Create your first energy listing.</p>
                        <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">+ Create Project</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {projects.map(project => {
                            const goal = project.funding_goal_inr ?? 0;
                            const raised = project.funds_raised_inr ?? 0;
                            const hasFunding = goal > 0;
                            const pct = hasFunding ? Math.min((raised / goal) * 100, 100) : 0;
                            const remaining = goal - raised;
                            const isFull = hasFunding && remaining <= 0;

                            return (
                                <div key={project.id} className="bg-surface-hover rounded-xl p-5 flex flex-col gap-3 border border-transparent hover:border-accent-green/20 transition-colors">
                                    {/* Energy type + price */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ENERGY_COLORS[project.energy_type]}`}>
                                                {ENERGY_ICONS[project.energy_type]} {project.energy_type.charAt(0).toUpperCase() + project.energy_type.slice(1)}
                                            </span>
                                            {project.location && <p className="text-xs text-text-muted mt-1.5">📍 {project.location}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-accent-green">
                                                {formatUSD(project.price_per_kwh)}<span className="text-xs text-text-muted font-normal">/kWh</span>
                                            </p>
                                        </div>
                                    </div>

                                    {project.description && (
                                        <p className="text-sm text-text-muted line-clamp-2">{project.description}</p>
                                    )}

                                    {/* kWh info */}
                                    <div className="pt-2 border-t border-border flex justify-between text-sm">
                                        <div>
                                            <p className="text-text-muted text-xs">Remaining</p>
                                            <p className="font-bold text-text-primary">{project.total_kwh.toFixed(0)} kWh</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-text-muted text-xs">Listed</p>
                                            <p className="text-text-muted text-xs">{formatDate(project.created_at)}</p>
                                        </div>
                                    </div>

                                    {/* Funding Progress (shown when goal set via energy_projects) */}
                                    {hasFunding && (
                                        <div className="pt-3 border-t border-border space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-semibold text-text-primary">💰 Funding Progress</p>
                                                {isFull ? (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20 font-semibold">Fully Funded ✓</span>
                                                ) : (
                                                    <span className="text-xs text-accent-blue font-semibold">{pct.toFixed(1)}%</span>
                                                )}
                                            </div>
                                            <div className="h-2 bg-border rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${isFull ? 'bg-accent-green' : 'bg-accent-blue'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div><p className="text-text-muted">Goal</p><p className="font-semibold text-text-primary">{formatINR(goal)}</p></div>
                                                <div><p className="text-text-muted">Raised</p><p className="font-semibold text-accent-green">{formatINR(raised)}</p></div>
                                                <div><p className="text-text-muted">Remaining</p><p className={`font-semibold ${isFull ? 'text-accent-green' : 'text-text-primary'}`}>{isFull ? '₹0' : formatINR(remaining)}</p></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Raise Funds button */}
                                    <button
                                        onClick={() => {
                                            setRaiseFundsProject(project);
                                            setRaiseError('');
                                            setRaiseSuccess('');
                                            setRaiseForm(EMPTY_RAISE_FORM);
                                        }}
                                        className="btn-secondary w-full text-sm mt-auto"
                                    >
                                        💰 Raise Funds
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recent Sales */}
            <div className="card p-5">
                <h3 className="section-title mb-5">Recent Sales</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium">Buyer</th>
                                <th className="pb-3 font-medium">Energy Type</th>
                                <th className="pb-3 font-medium">kWh Sold</th>
                                <th className="pb-3 font-medium">Revenue</th>
                                <th className="pb-3 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {purchases.map(p => (
                                <tr key={p.id} className="table-row-hover">
                                    <td className="py-3 text-text-primary font-medium">{p.buyer?.username ?? '—'}</td>
                                    <td className="py-3 text-text-muted text-xs">{p.energy_projects?.name ?? '—'}</td>
                                    <td className="py-3 text-text-primary font-semibold">{p.kwh_bought.toFixed(2)} kWh</td>
                                    <td className="py-3 text-accent-green font-semibold">{formatUSD(p.total_price)}</td>
                                    <td className="py-3 text-text-muted">{formatDate(p.created_at)}</td>
                                </tr>
                            ))}
                            {purchases.length === 0 && (
                                <tr><td colSpan={5} className="py-8 text-center text-text-muted">No sales yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══ CREATE PROJECT MODAL ══ */}
            <Modal open={showCreate} onClose={closeCreateModal} title="Create Energy Project">
                {createSuccess ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">{createSuccess}</div>
                        <button onClick={closeCreateModal} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-4">
                        {createError && <p className="text-sm text-danger">{createError}</p>}
                        <div>
                            <label className="input-label">Energy Type</label>
                            <select value={createForm.energy_type} onChange={e => setCreateForm(f => ({ ...f, energy_type: e.target.value as 'solar' | 'wind' | 'biogas' }))} className="input">
                                <option value="solar">☀️ Solar</option>
                                <option value="wind">🌬️ Wind</option>
                                <option value="biogas">🌿 Biogas</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="input-label">Total kWh Available</label>
                                <input type="number" min="1" step="0.01" required placeholder="e.g. 1000" value={createForm.total_kwh} onChange={e => setCreateForm(f => ({ ...f, total_kwh: e.target.value }))} className="input" />
                            </div>
                            <div>
                                <label className="input-label">Price per kWh (₹)</label>
                                <input type="number" min="0.01" step="0.01" required placeholder="e.g. 6" value={createForm.price_per_kwh} onChange={e => setCreateForm(f => ({ ...f, price_per_kwh: e.target.value }))} className="input" />
                            </div>
                        </div>
                        <div>
                            <label className="input-label">Location <span className="text-text-muted font-normal">(optional)</span></label>
                            <input type="text" placeholder="e.g. Rajasthan, India" value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} className="input" />
                        </div>
                        <div>
                            <label className="input-label">Description <span className="text-text-muted font-normal">(optional)</span></label>
                            <textarea rows={3} placeholder="Brief description of the project…" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className="input resize-none" />
                        </div>
                        <div className="pt-1 border-t border-border">
                            <label className="input-label">Funding Goal (₹ INR) <span className="text-text-muted font-normal">(optional)</span></label>
                            <input type="number" min="0" step="1" placeholder="e.g. 100000" value={createForm.funding_goal_inr} onChange={e => setCreateForm(f => ({ ...f, funding_goal_inr: e.target.value }))} className="input" />
                            <p className="text-xs text-text-muted mt-1">Set a goal to let investors fund this project directly. Or use "Raise Funds" on a project card later.</p>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={closeCreateModal} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={creating} className="btn-primary flex-1 disabled:opacity-60">{creating ? 'Creating…' : 'Create Project'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* ══ RAISE FUNDS MODAL ══ */}
            <Modal
                open={!!raiseFundsProject}
                onClose={closeRaiseModal}
                title={raiseFundsProject ? `💰 Raise Funds — ${raiseFundsProject.energy_type.charAt(0).toUpperCase() + raiseFundsProject.energy_type.slice(1)} Project` : ''}
            >
                {raiseSuccess ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green text-center">{raiseSuccess}</div>
                        <button onClick={closeRaiseModal} className="btn-primary w-full">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleRaiseFunds} className="space-y-4">
                        {raiseError && <p className="text-sm text-danger">{raiseError}</p>}

                        {/* Project summary */}
                        {raiseFundsProject && (
                            <div className="p-3 bg-surface-hover rounded-xl text-xs text-text-muted">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border ${ENERGY_COLORS[raiseFundsProject.energy_type]}`}>
                                    {ENERGY_ICONS[raiseFundsProject.energy_type]} {raiseFundsProject.energy_type}
                                </span>
                                {raiseFundsProject.location && <span className="ml-2">📍 {raiseFundsProject.location}</span>}
                            </div>
                        )}

                        <div>
                            <label className="input-label">Organization Name <span className="text-danger">*</span></label>
                            <input type="text" required placeholder="e.g. Green Energy Corp" value={raiseForm.organization_name} onChange={e => setRaiseForm(f => ({ ...f, organization_name: e.target.value }))} className="input" />
                        </div>

                        <div>
                            <label className="input-label">Organization Email <span className="text-text-muted font-normal">(optional)</span></label>
                            <input type="email" placeholder="contact@example.com" value={raiseForm.organization_email} onChange={e => setRaiseForm(f => ({ ...f, organization_email: e.target.value }))} className="input" />
                        </div>

                        <div>
                            <label className="input-label">Organization Type</label>
                            <select value={raiseForm.organization_type} onChange={e => setRaiseForm(f => ({ ...f, organization_type: e.target.value as 'government' | 'private' }))} className="input">
                                <option value="private">🏢 Private</option>
                                <option value="government">🏛️ Government</option>
                            </select>
                        </div>

                        <div>
                            <label className="input-label">Funding Goal (₹ INR) <span className="text-danger">*</span></label>
                            <input type="number" required min="1" step="1" placeholder="e.g. 500000" value={raiseForm.funding_goal_inr} onChange={e => setRaiseForm(f => ({ ...f, funding_goal_inr: e.target.value }))} className="input" />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={closeRaiseModal} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={raising} className="btn-primary flex-1 disabled:opacity-60">{raising ? 'Creating…' : 'Create Funding Request'}</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
