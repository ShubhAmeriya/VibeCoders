// =============================================================
// CryptoNex Platform - Shared TypeScript Types
// All database table shapes are defined here as TypeScript interfaces.
// These mirror the Supabase schema exactly.
// =============================================================

// ------------------------------------------------------------------
// profiles – user metadata + role + wallet balance
// ------------------------------------------------------------------
export interface Profile {
    id: string; // uuid, references auth.users.id
    username: string;
    role: 'investor' | 'buyer' | 'seller';
    wallet_balance_usd: number;
    created_at: string;
}

// ------------------------------------------------------------------
// crypto_asset – tradable crypto assets (Bitcoin, Ethereum, etc.)
// ------------------------------------------------------------------
export interface CryptoAsset {
    id: string;
    symbol: string; // e.g. "BTC"
    name: string; // e.g. "Bitcoin"
    current_price_usd: number;
    market_cap: number;
    volume_24h: number;
    created_at: string;
}

// ------------------------------------------------------------------
// portfolio – user's crypto holdings
// ------------------------------------------------------------------
export interface Portfolio {
    id: string;
    user_id: string; // references profiles.id
    crypto_id: string; // references crypto_asset.id
    quantity: number;
    average_buy_price: number;
    created_at: string;
    // Joined fields (not in DB)
    crypto_asset?: CryptoAsset;
}

// ------------------------------------------------------------------
// trades – log of all buy/sell transactions
// ------------------------------------------------------------------
export interface Trade {
    id: string;
    user_id: string;
    crypto_id: string;
    trade_type: 'buy' | 'sell';
    quantity: number;
    price_at_trade: number;
    total_value: number;
    created_at: string;
    // Joined fields
    crypto_asset?: CryptoAsset;
}

// ------------------------------------------------------------------
// wallet_transaction – all wallet movements (credit/debit)
// ------------------------------------------------------------------
export interface WalletTransaction {
    id: string;
    user_id: string;
    type: 'credit' | 'debit';
    amount_usd: number;
    crypto_symbol?: string; // Optional – present for trade-related movements
    created_at: string;
}

// ------------------------------------------------------------------
// projects – investment opportunities listed on the platform
// ------------------------------------------------------------------
export interface Project {
    id: string;
    name: string;
    description: string;
    expected_roi: number; // percentage
    risk_level: 'low' | 'medium' | 'high';
    duration_days: number;
    funding_goal: number;
    funded_amount: number;
    created_at: string;
}

// ------------------------------------------------------------------
// investments – links investors to projects
// ------------------------------------------------------------------
export interface Investment {
    id: string;
    user_id: string;
    project_id: string;
    amount: number;
    created_at: string;
    // Joined fields
    project?: Project;
}

// ------------------------------------------------------------------
// products – marketplace listings by sellers
// ------------------------------------------------------------------
export interface Product {
    id: string;
    seller_id: string; // references profiles.id
    title: string;
    description: string;
    price_usd: number;
    quantity: number;
    created_at: string;
}

// ------------------------------------------------------------------
// orders – records of product purchases by buyers
// ------------------------------------------------------------------
export interface Order {
    id: string;
    buyer_id: string; // references profiles.id
    product_id: string;
    quantity: number;
    total_amount: number;
    created_at: string;
    // Joined fields
    product?: Product;
}

// ------------------------------------------------------------------
// Utility types
// ------------------------------------------------------------------
export type UserRole = 'investor' | 'buyer' | 'seller';

export interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
}

export interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
}

// ------------------------------------------------------------------
// Renewable Energy Marketplace types
// ------------------------------------------------------------------
export interface EnergyProject {
    id: string;
    owner_id: string;
    energy_type: 'solar' | 'wind' | 'biogas';
    total_kwh: number;
    price_per_kwh: number;
    location: string | null;
    description: string | null;
    created_at: string;
    // Funding fields — added for investor fund-raising feature
    funding_goal_inr: number | null;
    funds_raised_inr: number | null;
    // optional join
    seller?: Pick<Profile, 'username'>;
}

export interface EnergyPurchase {
    id: string;
    buyer_id: string;
    seller_id: string;       // denormalised — the owner_id of the project at purchase time
    project_id: string;
    kwh_bought: number;
    total_price: number;
    created_at: string;
    // optional joins
    project?: Pick<EnergyProject, 'energy_type' | 'location' | 'price_per_kwh'>;
    buyer?: Pick<Profile, 'username'>;
}

