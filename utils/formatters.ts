// =============================================================
// formatters.ts – Utility helpers for formatting values
// Used throughout the UI for consistent presentation.
// =============================================================

/**
 * Format a number as INR currency string
 * e.g. 12345.67 → "₹12,345.67"
 */
export function formatUSD(amount: number, decimals = 2): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount);
}

/**
 * Format a large number with compact notation
 * e.g. 1200000 → "₹12L"
 */
export function formatCompactUSD(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format a percentage
 * e.g. 0.1234 → "12.34%"
 */
export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format a date string to a readable format
 * e.g. "2024-01-15T10:30:00Z" → "Jan 15, 2024"
 */
export function formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(dateString));
}

/**
 * Format a date to short datetime
 * e.g. "2024-01-15T10:30:00Z" → "Jan 15, 10:30 AM"
 */
export function formatDateTime(dateString: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(dateString));
}

/**
 * Format crypto quantity (up to 8 decimal places)
 */
export function formatQuantity(quantity: number): string {
    if (quantity >= 1) return quantity.toFixed(4);
    return quantity.toFixed(8);
}

/**
 * Get CSS color class for price change (positive = green, negative = red)
 */
export function getPriceChangeColor(change: number): string {
    return change >= 0 ? 'text-accent-green' : 'text-danger';
}

/**
 * Calculate percentage funded for a project
 */
export function calcFundedPercent(funded: number, goal: number): number {
    if (goal === 0) return 0;
    return Math.min((funded / goal) * 100, 100);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
