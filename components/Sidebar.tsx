'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import type { UserRole } from '@/types';

// Navigation items by role
const NAV_ITEMS: Record<UserRole, { href: string; label: string; icon: React.ReactNode }[]> = {
    investor: [
        { href: '/dashboard/investor', label: 'Dashboard', icon: <GridIcon /> },
        { href: '/dashboard/investor/funding', label: 'Funding', icon: <FundingIcon /> },
        { href: '/dashboard/investor/portfolio', label: 'Portfolio', icon: <ChartBarIcon /> },
        { href: '/dashboard/wallet', label: 'Wallet', icon: <WalletIcon /> },
    ],

    seller: [
        { href: '/dashboard/seller', label: 'Dashboard', icon: <GridIcon /> },
        { href: '/dashboard/seller/energy', label: 'My Products', icon: <LeafIcon /> },
        { href: '/dashboard/wallet', label: 'Wallet', icon: <WalletIcon /> },
    ],
    buyer: [
        { href: '/dashboard/buyer', label: 'Dashboard', icon: <GridIcon /> },
        { href: '/dashboard/buyer/market', label: 'Market', icon: <TrendingIcon /> },
        { href: '/dashboard/buyer/energy', label: 'Energy Market', icon: <LeafIcon /> },
        { href: '/dashboard/buyer/orders', label: 'My Orders', icon: <ClipboardIcon /> },
        { href: '/dashboard/wallet', label: 'Wallet', icon: <WalletIcon /> },
    ],
};

const COMMON_NAV = [
    { href: '/dashboard/settings', label: 'Settings', icon: <SettingsIcon /> },
];

interface SidebarProps {
    role: UserRole;
    username: string;
}

export function Sidebar({ role, username }: SidebarProps) {
    const pathname = usePathname();
    const items = NAV_ITEMS[role] ?? [];

    return (
        <aside className="w-64 min-h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0 z-30">
            {/* Logo */}
            <div className="px-6 py-5 border-b border-border">
                <Link href="/dashboard" className="flex items-center gap-2.5">
                    <img src="/logo.png" alt="VibeGrid Marketplace" className="w-9 h-9 object-contain flex-shrink-0" />
                    <div className="leading-tight">
                        <span className="text-base font-bold text-text-primary block leading-none">VibeGrid</span>
                        <span className="text-xs text-text-muted">Marketplace</span>
                    </div>
                </Link>
            </div>

            {/* User badge */}
            <div className="px-4 py-4 border-b border-border">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-hover rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-semibold text-sm flex-shrink-0">
                        {username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">{username}</div>
                        <div className="text-xs text-text-muted capitalize">{role}</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-4 space-y-1">
                <p className="px-3 py-1 text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    Menu
                </p>
                {items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                            pathname === item.href
                                ? 'bg-accent-green/10 text-accent-green'
                                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                        )}
                    >
                        <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                        {item.label}
                    </Link>
                ))}

                <div className="pt-4 mt-4 border-t border-border space-y-1">
                    {COMMON_NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                                pathname === item.href
                                    ? 'bg-accent-green/10 text-accent-green'
                                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                            )}
                        >
                            <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-border">
                <div className="px-3 py-2 rounded-xl bg-accent-green/5 border border-accent-green/20">
                    <div className="text-xs text-accent-green font-medium">Live Market Data</div>
                    <div className="text-xs text-text-muted mt-0.5">Real-time prices enabled</div>
                </div>
            </div>
        </aside>
    );
}

// ---- Icon components ----------------------------------------------------------------
function GridIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}

function BriefcaseIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
    );
}

function ChartBarIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    );
}

function WalletIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            <circle cx="16" cy="13" r="1" />
        </svg>
    );
}

function BoxIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    );
}

function ClipboardIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
        </svg>
    );
}

function TrendingIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

function LeafIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
    );
}

function FundingIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v2m0 8v2M9 9h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" />
        </svg>
    );
}

