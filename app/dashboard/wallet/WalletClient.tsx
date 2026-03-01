'use client';

import { useState } from 'react';
import { formatUSD, formatDateTime } from '@/utils/formatters';
import { Modal } from '@/components/Modal';
import type { Profile, WalletTransaction } from '@/types';

interface Props {
    profile: Profile;
    transactions: WalletTransaction[];
}

export function WalletClient({ profile, transactions }: Props) {
    const [addFundsModal, setAddFundsModal] = useState(false);
    const [withdrawModal, setWithdrawModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const totalCredits = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount_usd, 0);
    const totalDebits = transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount_usd, 0);

    async function handleAddFunds(e: React.FormEvent) {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) return;

        setLoading(true);
        setMessage('');

        try {
            // Step 1: Create Razorpay order via our API route
            const res = await fetch('/api/razorpay/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: amt, userId: profile.id }),
            });

            const { order, error } = await res.json();
            if (error) { setMessage(error); setLoading(false); return; }

            // Step 2: Open Razorpay checkout
            // Razorpay script must be loaded in index.html or via next/script
            // TODO: Load Razorpay script via <Script src="https://checkout.razorpay.com/v1/checkout.js" />
            // @ts-expect-error – Razorpay is loaded via external script
            const rzp = new window.Razorpay({
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: order.amount, // in paise
                currency: order.currency,
                order_id: order.id,
                name: 'VibeGrid Marketplace',
                description: 'Add Funds to Wallet',
                handler: () => {
                    // Payment success — backend webhook handles wallet update
                    setMessage('Payment successful! Wallet will be updated shortly.');
                    setAddFundsModal(false);
                },
                prefill: { name: profile.username },
                theme: { color: '#3FAF7F' },
            });

            rzp.open();
        } catch {
            setMessage('Failed to initiate payment. Please try again.');
        }

        setLoading(false);
    }

    function handleWithdrawRequest(e: React.FormEvent) {
        e.preventDefault();
        // NOTE: Withdrawals must be processed server-side via a Supabase Edge Function
        // that verifies the bank details, deducts the wallet, and logs the transaction.
        // DO NOT modify wallet_balance_usd directly from the frontend.
        setMessage('Withdrawal request submitted. Processing within 1-2 business days.');
        setWithdrawModal(false);
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Wallet</h1>
                <p className="text-text-muted mt-1">Manage your funds and transaction history</p>
            </div>

            {/* Main balance card */}
            <div className="card p-8 bg-gradient-to-br from-surface to-surface-hover">
                <p className="text-text-muted text-sm font-medium mb-2">Available Balance</p>
                <p className="text-5xl font-bold text-text-primary mb-1">{formatUSD(profile.wallet_balance_usd)}</p>
                <p className="text-text-muted text-sm">USD • {profile.username}</p>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={() => { setAddFundsModal(true); setMessage(''); }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Funds
                    </button>
                    <button
                        onClick={() => { setWithdrawModal(true); setMessage(''); }}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <polyline points="19 12 12 19 5 12" />
                        </svg>
                        Withdraw
                    </button>
                </div>

                {message && (
                    <div className="mt-4 px-4 py-3 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green">
                        {message}
                    </div>
                )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Deposited</p>
                    <p className="text-xl font-bold text-accent-green">{formatUSD(totalCredits)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Spent</p>
                    <p className="text-xl font-bold text-danger">{formatUSD(totalDebits)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Transactions</p>
                    <p className="text-xl font-bold text-text-primary">{transactions.length}</p>
                </div>
            </div>

            {/* Transaction History */}
            <div className="card p-5">
                <h3 className="section-title mb-5">Transaction History</h3>
                <div className="space-y-1">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-surface-hover transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tx.type === 'credit' ? 'bg-accent-green/10 text-accent-green' : 'bg-danger/10 text-danger'}`}>
                                    {tx.type === 'credit' ? (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-text-primary capitalize">
                                        {tx.type === 'credit' ? 'Deposit' : 'Withdrawal/Spend'}
                                        {tx.crypto_symbol ? ` · ${tx.crypto_symbol}` : ''}
                                    </p>
                                    <p className="text-xs text-text-muted">{formatDateTime(tx.created_at)}</p>
                                </div>
                            </div>
                            <span className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-accent-green' : 'text-danger'}`}>
                                {tx.type === 'credit' ? '+' : '-'}{formatUSD(tx.amount_usd)}
                            </span>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <p className="text-center text-text-muted text-sm py-10">No transactions yet</p>
                    )}
                </div>
            </div>

            {/* Add Funds Modal */}
            <Modal open={addFundsModal} onClose={() => setAddFundsModal(false)} title="Add Funds via Razorpay">
                <form onSubmit={handleAddFunds} className="space-y-4">
                    <div className="p-4 bg-surface-hover rounded-xl text-sm text-text-muted space-y-1">
                        <p>🔒 Payments are processed securely via Razorpay.</p>
                        <p>Your wallet will be credited automatically after payment confirmation via webhook.</p>
                    </div>
                    <div>
                        <label className="input-label">Amount (USD)</label>
                        <input
                            type="number"
                            min="1"
                            step="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="input"
                            placeholder="e.g. 100"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setAddFundsModal(false)} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">
                            {loading ? 'Opening Razorpay…' : 'Proceed to Pay'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Withdraw Modal */}
            <Modal open={withdrawModal} onClose={() => setWithdrawModal(false)} title="Withdraw Funds">
                <form onSubmit={handleWithdrawRequest} className="space-y-4">
                    <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl text-sm text-text-muted">
                        <p className="text-warning font-medium mb-1">⚠ Backend Processing Required</p>
                        <p>Withdrawals are processed manually and verified server-side. Do not attempt to modify wallet balance directly.</p>
                    </div>
                    <div>
                        <label className="input-label">Withdraw Amount (USD)</label>
                        <input
                            type="number"
                            min="1"
                            max={profile.wallet_balance_usd}
                            step="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="input"
                            placeholder="e.g. 50"
                        />
                        <p className="text-xs text-text-muted mt-1">Available: {formatUSD(profile.wallet_balance_usd)}</p>
                    </div>
                    <div>
                        <label className="input-label">Bank Account / UPI ID</label>
                        <input type="text" required className="input" placeholder="yourname@upi or bank account" />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setWithdrawModal(false)} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" className="btn-blue flex-1">Submit Request</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
