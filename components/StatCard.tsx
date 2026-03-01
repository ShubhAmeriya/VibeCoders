// =============================================================
// StatCard.tsx – Reusable KPI stat card component
// Used across all three role dashboards to display metrics.
// =============================================================

interface StatCardProps {
    title: string;
    value: string;
    sub?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    icon?: React.ReactNode;
    accentColor?: 'green' | 'blue' | 'neutral';
}

export function StatCard({
    title,
    value,
    sub,
    trend,
    trendValue,
    icon,
    accentColor = 'neutral',
}: StatCardProps) {
    const accentMap = {
        green: 'bg-accent-green/10 text-accent-green',
        blue: 'bg-accent-blue/10 text-accent-blue',
        neutral: 'bg-surface-hover text-text-muted',
    };

    const trendColorMap = {
        up: 'text-accent-green',
        down: 'text-danger',
        neutral: 'text-text-muted',
    };

    const trendArrow = { up: '↑', down: '↓', neutral: '—' };

    return (
        <div className="card p-5 flex flex-col gap-3 hover:border-accent-blue/30 transition-colors duration-200">
            <div className="flex items-start justify-between">
                <p className="text-sm text-text-muted font-medium">{title}</p>
                {icon && (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentMap[accentColor]}`}>
                        <span className="w-5 h-5">{icon}</span>
                    </div>
                )}
            </div>
            <div>
                <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
                {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
            </div>
            {trend && trendValue && (
                <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium ${trendColorMap[trend]}`}>
                        {trendArrow[trend]} {trendValue}
                    </span>
                    <span className="text-xs text-text-muted">vs last period</span>
                </div>
            )}
        </div>
    );
}
