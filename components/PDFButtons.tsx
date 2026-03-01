'use client';
// Thin client component — renders a download button, generates PDF on click.
// Props are plain serializable data passed from server components.

import { downloadBuyerPDF, downloadSellerPDF, downloadInvestorPDF } from '@/utils/pdfReports';
import type { BuyerOrderRow, BuyerProductOrderRow, SellerSaleRow, InvestorInvestRow } from '@/utils/pdfReports';

// ── Buyer ────────────────────────────────────────────────────
interface BuyerProps {
    username: string;
    energyOrders: BuyerOrderRow[];
    productOrders: BuyerProductOrderRow[];
}
export function BuyerPDFButton({ username, energyOrders, productOrders }: BuyerProps) {
    return (
        <button
            onClick={() => downloadBuyerPDF(username, energyOrders, productOrders)}
            className="btn-secondary text-sm flex items-center gap-2"
        >
            <span>⬇</span> Download PDF Report
        </button>
    );
}

// ── Seller ───────────────────────────────────────────────────
interface SellerProps { username: string; sales: SellerSaleRow[] }
export function SellerPDFButton({ username, sales }: SellerProps) {
    return (
        <button
            onClick={() => downloadSellerPDF(username, sales)}
            className="btn-secondary text-sm flex items-center gap-2"
        >
            <span>⬇</span> Download PDF Report
        </button>
    );
}

// ── Investor ─────────────────────────────────────────────────
interface InvestorProps { username: string; investments: InvestorInvestRow[] }
export function InvestorPDFButton({ username, investments }: InvestorProps) {
    return (
        <button
            onClick={() => downloadInvestorPDF(username, investments)}
            className="btn-secondary text-sm flex items-center gap-2"
        >
            <span>⬇</span> Download PDF Report
        </button>
    );
}
