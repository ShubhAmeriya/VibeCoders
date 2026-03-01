'use client';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register all required Chart.js components globally
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// ---- Shared dark-theme chart defaults ----------------------------------------
const DARK_DEFAULTS = {
    plugins: {
        legend: {
            labels: {
                color: '#9CA3AF',
                font: { family: 'Inter', size: 12 },
                boxWidth: 12,
                padding: 16,
            },
        },
        tooltip: {
            backgroundColor: '#2C2C2C',
            borderColor: '#3A3A3A',
            borderWidth: 1,
            titleColor: '#F9FAFB',
            bodyColor: '#D1D5DB',
            padding: 12,
            cornerRadius: 10,
        },
    },
    scales: {
        x: {
            grid: { color: '#3A3A3A', drawBorder: false },
            ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 } },
        },
        y: {
            grid: { color: '#3A3A3A', drawBorder: false },
            ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 } },
        },
    },
    responsive: true,
    maintainAspectRatio: false,
};

// ---- Portfolio Line Chart ----------------------------------------------------
interface LineChartProps {
    labels: string[];
    data: number[];
    label?: string;
}

export function PortfolioLineChart({ labels, data, label = 'Portfolio Value' }: LineChartProps) {
    const chartData = {
        labels,
        datasets: [
            {
                label,
                data,
                borderColor: '#3FAF7F',
                backgroundColor: 'rgba(63,175,127,0.08)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#3FAF7F',
                pointBorderColor: '#2C2C2C',
                pointBorderWidth: 2,
                borderWidth: 2,
            },
        ],
    };

    return (
        <div className="h-64">
            <Line
                data={chartData}
                options={{
                    ...DARK_DEFAULTS,
                    plugins: {
                        ...DARK_DEFAULTS.plugins,
                        legend: { display: false },
                    },
                }}
            />
        </div>
    );
}

// ---- Revenue Bar Chart -------------------------------------------------------
interface BarChartProps {
    labels: string[];
    data: number[];
    label?: string;
}

export function RevenueBarChart({ labels, data, label = 'Revenue (USD)' }: BarChartProps) {
    const chartData = {
        labels,
        datasets: [
            {
                label,
                data,
                backgroundColor: 'rgba(74,144,226,0.7)',
                borderColor: '#4A90E2',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
            },
        ],
    };

    return (
        <div className="h-64">
            <Bar data={chartData} options={DARK_DEFAULTS} />
        </div>
    );
}

// ---- Investment Distribution Pie/Doughnut Chart ------------------------------
interface DoughnutChartProps {
    labels: string[];
    data: number[];
}

export function InvestmentDoughnut({ labels, data }: DoughnutChartProps) {
    const COLORS = [
        '#3FAF7F',
        '#4A90E2',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#14B8A6',
    ];

    const chartData = {
        labels,
        datasets: [
            {
                data,
                backgroundColor: COLORS.slice(0, data.length).map((c) => `${c}CC`),
                borderColor: COLORS.slice(0, data.length),
                borderWidth: 1.5,
                hoverOffset: 6,
            },
        ],
    };

    return (
        <div className="h-64 flex items-center justify-center">
            <Doughnut
                data={chartData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#9CA3AF',
                                font: { family: 'Inter', size: 11 },
                                boxWidth: 10,
                                padding: 12,
                            },
                        },
                        tooltip: DARK_DEFAULTS.plugins.tooltip,
                    },
                }}
            />
        </div>
    );
}
