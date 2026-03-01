'use client';

// =============================================================
// /app/dashboard/settings/SettingsClient.tsx
//
// Handles:
//   PART 1 — Change Password (supabase.auth.updateUser)
//   PART 2 — 2FA  → "Coming Soon" (too complex for hackathon)
//   PART 3 — Delete Account → confirm modal → DELETE /api/account/delete
// =============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { createClient } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

interface Props { profile: Profile }

export function SettingsClient({ profile }: Props) {
    const router = useRouter();

    // ── Change Password state ─────────────────────────────────
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');

    // ── Delete Account state ──────────────────────────────────
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // ─── Change Password ──────────────────────────────────────
    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        setPwdError(''); setPwdSuccess('');

        if (newPassword.length < 8) {
            setPwdError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwdError('Passwords do not match.');
            return;
        }

        setPwdSaving(true);
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setPwdSaving(false);

        if (error) {
            setPwdError(error.message);
        } else {
            setPwdSuccess('✅ Password updated successfully!');
            setNewPassword('');
            setConfirmPassword('');
        }
    }

    // ─── Delete Account ───────────────────────────────────────
    async function handleDeleteAccount() {
        if (deleteConfirm !== profile.username) {
            setDeleteError(`Type your username "${profile.username}" to confirm deletion.`);
            return;
        }
        setDeleting(true); setDeleteError('');

        const res = await fetch('/api/account/delete', { method: 'DELETE' });
        const data = await res.json();

        if (!res.ok || data.error) {
            setDeleteError(data.error ?? 'Delete failed. Please try again.');
            setDeleting(false);
            return;
        }

        // Redirect to login — account is gone
        router.push('/auth/login');
    }

    return (
        <>
            {/* ── Security Section ──────────────────────────────── */}
            <div className="card p-6 space-y-4">
                <h3 className="section-title">Security</h3>
                <div className="space-y-3">

                    {/* 2FA — Coming Soon */}
                    <div className="p-4 bg-surface-hover rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-text-primary">Two-Factor Authentication</p>
                            <p className="text-xs text-text-muted">Add an extra layer of security to your account</p>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-border text-text-muted cursor-not-allowed">
                            Coming Soon
                        </span>
                    </div>

                    {/* Change Password */}
                    <div className="p-4 bg-surface-hover rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-text-primary">Change Password</p>
                                <p className="text-xs text-text-muted">Update your login credentials</p>
                            </div>
                            <button
                                onClick={() => { setShowPasswordForm((v) => !v); setPwdError(''); setPwdSuccess(''); }}
                                className="btn-secondary text-xs py-2"
                            >
                                {showPasswordForm ? 'Cancel' : 'Update'}
                            </button>
                        </div>

                        {showPasswordForm && (
                            <form onSubmit={handleChangePassword} className="space-y-3 pt-1 border-t border-border">
                                {pwdError && <p className="text-sm text-danger">{pwdError}</p>}
                                {pwdSuccess && <p className="text-sm text-accent-green">{pwdSuccess}</p>}
                                <div>
                                    <label className="input-label">New Password (min 8 chars)</label>
                                    <input
                                        type="password" required minLength={8}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="input"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Confirm New Password</label>
                                    <input
                                        type="password" required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="input"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <button type="submit" disabled={pwdSaving} className="btn-primary w-full disabled:opacity-60">
                                    {pwdSaving ? 'Saving…' : 'Save New Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Danger Zone ───────────────────────────────────── */}
            <div className="card p-6 border-danger/30 space-y-4">
                <h3 className="section-title text-danger">Danger Zone</h3>
                <div className="p-4 bg-danger/5 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-text-primary">Delete Account</p>
                        <p className="text-xs text-text-muted">
                            Permanently removes your account, purchases, and all associated data.
                        </p>
                    </div>
                    <button
                        onClick={() => { setShowDeleteModal(true); setDeleteError(''); setDeleteConfirm(''); }}
                        className="btn-danger text-xs py-2 flex-shrink-0"
                    >
                        Delete
                    </button>
                </div>
            </div>

            {/* ── Delete Confirm Modal ──────────────────────────── */}
            <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="⚠️ Delete Account">
                <div className="space-y-4">
                    <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger">
                        This action is <strong>permanent and irreversible</strong>. All your data will be deleted:
                        <ul className="mt-2 list-disc list-inside space-y-0.5 text-xs">
                            {profile.role === 'buyer' && <><li>All energy purchases</li><li>All product orders</li></>}
                            {profile.role === 'seller' && <><li>All energy projects</li><li>All sales data</li><li>All related investments<br /></li></>}
                            {profile.role === 'investor' && <li>All investments</li>}
                            <li>Your profile</li>
                        </ul>
                    </div>

                    {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

                    <div>
                        <label className="input-label">
                            Type <span className="text-text-primary font-semibold">{profile.username}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            className="input"
                            placeholder={profile.username}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleting || deleteConfirm !== profile.username}
                            className="btn-danger flex-1 disabled:opacity-40"
                        >
                            {deleting ? 'Deleting…' : 'Yes, Delete Forever'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
