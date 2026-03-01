// =============================================================
// /app/dashboard/wallet/page.tsx – Wallet Management Page
//
// Displays:
// - Current wallet balance
// - Add funds (via Razorpay)
// - Withdraw (placeholder — requires backend validation)
// - Full transaction history
//
// IMPORTANT: Wallet balance (wallet_balance_usd in profiles table)
// is NEVER modified directly from this page.
// It is updated ONLY in the Razorpay webhook handler after
// successful payment verification.
// =============================================================

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { WalletClient } from './WalletClient';
import type { Profile, WalletTransaction } from '@/types';

export default async function WalletPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile) redirect('/auth/login');

    const { data: transactions } = await supabase
        .from('wallet_transaction')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<WalletTransaction[]>();

    return <WalletClient profile={profile} transactions={transactions ?? []} />;
}
