'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUpWithEmail, signInWithGoogle } from '@/utils/auth';
import type { UserRole } from '@/types';

const ROLES: { value: UserRole; label: string; description: string }[] = [
    {
        value: 'investor',
        label: 'Investor',
        description: 'Invest in curated projects and track your portfolio',
    },
    {
        value: 'buyer',
        label: 'Buyer',
        description: 'Browse the marketplace and purchase products',
    },
    {
        value: 'seller',
        label: 'Seller',
        description: 'List and sell products on the marketplace',
    },
];

export default function SignupPage() {
    const router = useRouter();
    const [step, setStep] = useState<'role' | 'details'>('role');
    const [role, setRole] = useState<UserRole | null>(null);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    function handleRoleSelect(r: UserRole) {
        setRole(r);
        setStep('details');
    }

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        if (!role) return;
        setLoading(true);
        setError('');
        const { error } = await signUpWithEmail(email, password, username, role);
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            router.push('/dashboard');
        }
    }

    async function handleGoogleLogin() {
        const { error } = await signInWithGoogle();
        if (error) setError(error.message);
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex flex-col items-center gap-1 mb-4">
                        <img src="/logo.png" alt="VibeGrid Marketplace" className="h-20 w-auto object-contain" />
                    </div>
                    <h1 className="text-2xl font-semibold text-text-primary">Create your account</h1>
                    <p className="text-text-muted mt-2 text-sm">
                        {step === 'role'
                            ? 'Choose how you want to use VibeGrid Marketplace'
                            : `Creating account as ${role}`}
                    </p>
                </div>

                <div className="card p-8 shadow-card">
                    {error && (
                        <div className="mb-5 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger">
                            {error}
                        </div>
                    )}

                    {step === 'role' && (
                        <div className="space-y-3">
                            {/* Role selection MUST happen before account creation */}
                            {ROLES.map((r) => (
                                <button
                                    key={r.value}
                                    onClick={() => handleRoleSelect(r.value)}
                                    className="w-full p-4 bg-surface-hover hover:bg-border border border-border hover:border-accent-green rounded-xl text-left transition-all duration-200 group"
                                >
                                    <div className="font-semibold text-text-primary group-hover:text-accent-green transition-colors">
                                        {r.label}
                                    </div>
                                    <div className="text-sm text-text-muted mt-0.5">{r.description}</div>
                                </button>
                            ))}

                            <div className="flex items-center gap-3 mt-5">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-text-muted text-xs">or</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-surface-hover hover:bg-border border border-border rounded-xl text-text-primary text-sm font-medium transition-all duration-200"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Sign up with Google
                            </button>
                        </div>
                    )}

                    {step === 'details' && (
                        <form onSubmit={handleSignup} className="space-y-5">
                            <button
                                type="button"
                                onClick={() => setStep('role')}
                                className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-2"
                            >
                                ← Change role
                            </button>

                            <div>
                                <label htmlFor="username" className="input-label">Username</label>
                                <input
                                    id="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input"
                                    placeholder="johndoe"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="input-label">Email address</label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="input-label">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input"
                                    placeholder="Min. 6 characters"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating account…' : 'Create account'}
                            </button>
                        </form>
                    )}

                    <p className="mt-6 text-center text-sm text-text-muted">
                        Already have an account?{' '}
                        <Link href="/auth/login" className="text-accent-green hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
