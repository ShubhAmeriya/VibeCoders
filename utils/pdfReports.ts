// =============================================================
// /utils/pdfReports.ts
// Shared jsPDF report generators for Buyer, Seller, Investor.
// All monetary values shown in ₹ INR.
// Each function returns void — triggers browser download directly.
// =============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Buyer PDF ────────────────────────────────────────────────
export interface BuyerOrderRow {
    id: string;
    sellerName: string | null;
    energyType: string | null;
    kwhBought: number;
    totalPaid: number;
    date: string;
}

export interface BuyerProductOrderRow {
    id: string;
    product: string | null;
    quantity: number;
    totalPaid: number;
    date: string;
}

export function downloadBuyerPDF(
    username: string,
    energyOrders: BuyerOrderRow[],
    productOrders: BuyerProductOrderRow[],
) {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('en-IN');

    doc.setFontSize(20);
    doc.setTextColor(52, 211, 153);
    doc.text('GreenGrid Exchange', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Buyer Report — ${username}`, 14, 26);
    doc.text(`Generated: ${now}`, 14, 32);

    // Energy Purchases
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text('Energy Purchases', 14, 44);

    const energyTotal = energyOrders.reduce((s, o) => s + o.totalPaid, 0);
    const totalKwh = energyOrders.reduce((s, o) => s + o.kwhBought, 0);

    autoTable(doc, {
        startY: 48,
        head: [['Order ID', 'Seller', 'Type', 'kWh', 'Amount Paid (₹)', 'Date']],
        body: energyOrders.map((o) => [
            o.id.slice(0, 8) + '…',
            o.sellerName ?? '—',
            o.energyType ? o.energyType.charAt(0).toUpperCase() + o.energyType.slice(1) : '—',
            o.kwhBought.toFixed(2),
            `₹${o.totalPaid.toFixed(2)}`,
            new Date(o.date).toLocaleDateString('en-IN'),
        ]),
        foot: [['', '', '', `${totalKwh.toFixed(2)} kWh`, `₹${energyTotal.toFixed(2)}`, '']],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [52, 211, 153], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
    });

    const y1 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    // Product Orders
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text('Product Orders', 14, y1);

    const productTotal = productOrders.reduce((s, o) => s + o.totalPaid, 0);

    autoTable(doc, {
        startY: y1 + 4,
        head: [['Order ID', 'Product', 'Qty', 'Amount Paid (₹)', 'Date']],
        body: productOrders.map((o) => [
            o.id.slice(0, 8) + '…',
            o.product ?? '—',
            o.quantity,
            `₹${o.totalPaid.toFixed(2)}`,
            new Date(o.date).toLocaleDateString('en-IN'),
        ]),
        foot: [['', '', '', `₹${productTotal.toFixed(2)}`, '']],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
    });

    doc.save(`buyer-report-${username}-${Date.now()}.pdf`);
}

// ── Seller PDF ───────────────────────────────────────────────
export interface SellerSaleRow {
    orderId: string;
    buyerName: string | null;
    buyerEmail: string | null;
    energyType: string | null;
    kwhSold: number;
    totalPaid: number;
    date: string;
}

export function downloadSellerPDF(username: string, sales: SellerSaleRow[]) {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('en-IN');

    doc.setFontSize(20);
    doc.setTextColor(52, 211, 153);
    doc.text('GreenGrid Exchange', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Seller Sales Report — ${username}`, 14, 26);
    doc.text(`Generated: ${now}`, 14, 32);

    const totalSales = sales.reduce((s, o) => s + o.totalPaid, 0);
    const totalKwh = sales.reduce((s, o) => s + o.kwhSold, 0);

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Total Revenue: ₹${totalSales.toFixed(2)}   |   Total kWh Sold: ${totalKwh.toFixed(2)}   |   Orders: ${sales.length}`, 14, 42);

    autoTable(doc, {
        startY: 48,
        head: [['Order ID', 'Buyer', 'Email', 'Type', 'kWh Sold', 'Total (₹)', 'Date']],
        body: sales.map((o) => [
            o.orderId.slice(0, 8) + '…',
            o.buyerName ?? '—',
            o.buyerEmail ?? '—',
            o.energyType ? o.energyType.charAt(0).toUpperCase() + o.energyType.slice(1) : '—',
            o.kwhSold.toFixed(2),
            `₹${o.totalPaid.toFixed(2)}`,
            new Date(o.date).toLocaleDateString('en-IN'),
        ]),
        foot: [['', '', '', '', `${totalKwh.toFixed(2)} kWh`, `₹${totalSales.toFixed(2)}`, '']],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [52, 211, 153], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
    });

    doc.save(`seller-report-${username}-${Date.now()}.pdf`);
}

// ── Investor PDF ─────────────────────────────────────────────
export interface InvestorInvestRow {
    id: string;
    energyType: string | null;
    location: string | null;
    amountInvested: number;
    fundingGoal: number | null;
    fundsRaised: number | null;
    date: string;
}

export function downloadInvestorPDF(username: string, investments: InvestorInvestRow[]) {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('en-IN');

    doc.setFontSize(20);
    doc.setTextColor(52, 211, 153);
    doc.text('GreenGrid Exchange', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Investor Report — ${username}`, 14, 26);
    doc.text(`Generated: ${now}`, 14, 32);

    const totalInvested = investments.reduce((s, i) => s + i.amountInvested, 0);
    const uniqueProjects = new Set(investments.map((i) => i.energyType)).size;

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Total Invested: ₹${totalInvested.toLocaleString('en-IN')}   |   Projects: ${uniqueProjects}   |   Investments: ${investments.length}`, 14, 42);

    autoTable(doc, {
        startY: 48,
        head: [['#', 'Energy Type', 'Location', 'Amount Invested (₹)', 'Funding Goal (₹)', 'Raised (₹)', 'Progress', 'Date']],
        body: investments.map((inv, i) => {
            const goal = inv.fundingGoal ?? 0;
            const raised = inv.fundsRaised ?? 0;
            const pct = goal > 0 ? ((raised / goal) * 100).toFixed(1) + '%' : '—';
            return [
                i + 1,
                inv.energyType ? inv.energyType.charAt(0).toUpperCase() + inv.energyType.slice(1) : '—',
                inv.location ?? '—',
                `₹${inv.amountInvested.toLocaleString('en-IN')}`,
                goal > 0 ? `₹${goal.toLocaleString('en-IN')}` : '—',
                raised > 0 ? `₹${raised.toLocaleString('en-IN')}` : '—',
                pct,
                new Date(inv.date).toLocaleDateString('en-IN'),
            ];
        }),
        foot: [['', '', 'TOTAL', `₹${totalInvested.toLocaleString('en-IN')}`, '', '', '', '']],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [139, 92, 246], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
    });

    doc.save(`investor-report-${username}-${Date.now()}.pdf`);
}
