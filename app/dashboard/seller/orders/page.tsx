import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, Order } from '@/types';
import { formatUSD, formatDate } from '@/utils/formatters';

export default async function SellerOrdersPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'seller') redirect('/dashboard');

    // First get seller's product IDs
    const { data: products } = await supabase
        .from('products').select('id, title').eq('seller_id', user.id);

    const productIds = (products ?? []).map(p => p.id);

    const { data: orders } = productIds.length
        ? await supabase
            .from('orders').select('*, product:products(title, price_usd)')
            .in('product_id', productIds)
            .order('created_at', { ascending: false })
            .returns<Order[]>()
        : { data: [] as Order[] };

    const totalRevenue = (orders ?? []).reduce((s, o) => s + o.total_amount, 0);
    const totalUnitsSold = (orders ?? []).reduce((s, o) => s + o.quantity, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Order History</h1>
                <p className="text-text-muted mt-1">All purchases made on your products</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-accent-green">{formatUSD(totalRevenue)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-text-primary">{(orders ?? []).length}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Units Sold</p>
                    <p className="text-2xl font-bold text-accent-blue">{totalUnitsSold}</p>
                </div>
            </div>

            {/* Orders Table */}
            <div className="card p-5">
                <h3 className="section-title mb-5">All Orders</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium">Product</th>
                                <th className="pb-3 font-medium">Qty</th>
                                <th className="pb-3 font-medium">Total</th>
                                <th className="pb-3 font-medium">Date</th>
                                <th className="pb-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(orders ?? []).map((order) => (
                                <tr key={order.id} className="table-row-hover">
                                    <td className="py-3 font-semibold text-text-primary">{order.product?.title ?? '—'}</td>
                                    <td className="py-3 text-text-primary">{order.quantity}</td>
                                    <td className="py-3 text-accent-green font-semibold">{formatUSD(order.total_amount)}</td>
                                    <td className="py-3 text-text-muted">{formatDate(order.created_at)}</td>
                                    <td className="py-3"><span className="badge-green">Completed</span></td>
                                </tr>
                            ))}
                            {(orders ?? []).length === 0 && (
                                <tr><td colSpan={5} className="py-10 text-center text-text-muted">No orders yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
