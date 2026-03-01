'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/utils/auth';
import { formatUSD } from '@/utils/formatters';
import type { UserRole } from '@/types';

interface NavbarProps {
    username: string;
    role: UserRole;
    walletBalance: number;
    title?: string;
}

export function Navbar({ username, role, walletBalance, title }: NavbarProps) {
    const router = useRouter();

    async function handleSignOut() {
        await signOut();
        router.push('/auth/login');
        router.refresh();
    }

    return (
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
            {/* Page title */}
            <div>
                <h2 className="text-base font-semibold text-text-primary">{title ?? 'Dashboard'}</h2>
                <p className="text-xs text-text-muted capitalize">{role} account</p>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
                {/* Wallet Balance Chip */}
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover border border-border rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                    <span className="text-sm font-semibold text-text-primary">{formatUSD(walletBalance)}</span>
                    <span className="text-xs text-text-muted hidden sm:block">Wallet</span>
                </div>


                {/* User menu */}
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-hover border border-border hover:border-danger/50 hover:text-danger text-text-secondary text-sm font-medium transition-all duration-200"
                >
                    <div className="w-7 h-7 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-semibold text-xs">
                        {username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="hidden sm:block">{username}</span>
                    <svg className="w-4 h-4 hidden sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>
        </header>
    );
}
