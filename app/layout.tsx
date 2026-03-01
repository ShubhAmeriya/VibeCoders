import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'VibeGrid Marketplace – Renewable Energy Trading & Investment',
    description:
        'VibeGrid Marketplace: A professional-grade renewable energy trading, investment, and marketplace platform. Invest in green projects, buy/sell energy.',
    keywords: ['renewable energy', 'green energy', 'investment', 'marketplace', 'solar', 'wind', 'biogas'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="bg-background text-text-primary antialiased">{children}</body>
        </html>
    );
}
