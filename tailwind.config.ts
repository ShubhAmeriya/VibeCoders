/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                background: '#1E1E1E',
                surface: '#2C2C2C',
                'surface-hover': '#363636',
                accent: {
                    green: '#3FAF7F',
                    'green-muted': '#2d8060',
                    blue: '#4A90E2',
                    'blue-muted': '#3270bb',
                },
                border: '#3A3A3A',
                muted: '#6B7280',
                'text-primary': '#F9FAFB',
                'text-secondary': '#D1D5DB',
                'text-muted': '#9CA3AF',
                danger: '#EF4444',
                warning: '#F59E0B',
                success: '#10B981',
            },
            borderRadius: {
                card: '16px',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,0.3)',
                dropdown: '0 4px 16px rgba(0,0,0,0.4)',
            },
        },
    },
    plugins: [],
};
