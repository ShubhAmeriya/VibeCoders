import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, Product } from '@/types';
import { formatUSD, formatDate } from '@/utils/formatters';

function fmt(n: number) {
    if (!n) return '—';
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toFixed(2)}`;
}

export default async function BuyerMarketPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'buyer') redirect('/dashboard');

    const { data: products } = await supabase
        .from('products').select('*')
        .order('created_at', { ascending: false })
        .returns<Product[]>();

    const inStock = (products ?? []).filter(p => p.quantity > 0);
    const outOfStock = (products ?? []).filter(p => p.quantity === 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Marketplace</h1>
                    <p className="text-text-muted mt-1">All available products</p>
                </div>
                <div className="card px-4 py-2 text-sm">
                    <span className="text-text-muted">Wallet: </span>
                    <span className="text-accent-green font-bold">{formatUSD(profile.wallet_balance_usd)}</span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Products</p>
                    <p className="text-2xl font-bold text-text-primary">{(products ?? []).length}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">In Stock</p>
                    <p className="text-2xl font-bold text-accent-green">{inStock.length}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Out of Stock</p>
                    <p className="text-2xl font-bold text-danger">{outOfStock.length}</p>
                </div>
            </div>

            {/* Products Table */}
            <div className="card p-5">
                <h3 className="section-title mb-5">All Listings</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium">Product</th>
                                <th className="pb-3 font-medium">Description</th>
                                <th className="pb-3 font-medium">Price</th>
                                <th className="pb-3 font-medium">Stock</th>
                                <th className="pb-3 font-medium">Listed</th>
                                <th className="pb-3 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(products ?? []).map((product) => (
                                <tr key={product.id} className="table-row-hover">
                                    <td className="py-3 font-semibold text-text-primary max-w-[160px] truncate">{product.title}</td>
                                    <td className="py-3 text-text-muted max-w-[200px]">
                                        <span className="line-clamp-1">{product.description}</span>
                                    </td>
                                    <td className="py-3 text-accent-green font-semibold">{formatUSD(product.price_usd)}</td>
                                    <td className="py-3 text-text-primary">{product.quantity}</td>
                                    <td className="py-3 text-text-muted">{formatDate(product.created_at)}</td>
                                    <td className="py-3">
                                        {product.quantity > 0 ? (
                                            <a href="/dashboard/buyer" className="btn-primary text-xs py-1.5 px-3">Buy</a>
                                        ) : (
                                            <span className="badge-danger">Out of Stock</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(products ?? []).length === 0 && (
                                <tr><td colSpan={6} className="py-10 text-center text-text-muted">No products available</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
