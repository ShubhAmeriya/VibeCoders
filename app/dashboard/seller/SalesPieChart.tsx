'use client';

// =============================================================
// /app/dashboard/seller/SalesPieChart.tsx
// Recharts Pie chart — Revenue distribution by energy type
// =============================================================

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieEntry {
    name: string;
    value: number;
}

interface Props {
    data: PieEntry[];
}

const COLORS: Record<string, string> = {
    Solar: '#fbbf24',
    Wind: '#60a5fa',
    Biogas: '#34d399',
    Unknown: '#94a3b8',
};
const FALLBACK_COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#a78bfa', '#f87171'];

function formatINR(value: number) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function SalesPieChart({ data }: Props) {
    if (!data.length || data.every((d) => d.value === 0)) {
        return (
            <div className="flex items-center justify-center h-52 text-text-muted text-sm">
                No sales data yet
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={260}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={3}
                    label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
                    }
                    labelLine={false}
                >
                    {data.map((entry, i) => (
                        <Cell
                            key={entry.name}
                            fill={COLORS[entry.name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                        />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: number | undefined) => [formatINR(value ?? 0), 'Revenue'] as [string, string]}
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                        fontSize: 13,
                    }}
                />
                <Legend
                    iconType="circle"
                    wrapperStyle={{ color: '#94a3b8', fontSize: 13, paddingTop: 12 }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
