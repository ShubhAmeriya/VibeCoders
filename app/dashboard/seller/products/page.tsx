import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import type { Profile, Product } from '@/types';
import { formatUSD, formatDate } from '@/utils/formatters';

export default async function SellerProductsPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
    if (!profile || profile.role !== 'seller') redirect('/dashboard');

    const { data: products } = await supabase
        .from('products').select('*').eq('seller_id', user.id)
        .order('created_at', { ascending: false }).returns<Product[]>();

    const totalStock = (products ?? []).reduce((s, p) => s + p.quantity, 0);
    const avgPrice = (products ?? []).length
        ? (products ?? []).reduce((s, p) => s + p.price_usd, 0) / (products ?? []).length
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">My Products</h1>
                    <p className="text-text-muted mt-1">Manage your marketplace listings</p>
                </div>
                <a href="/dashboard/seller" className="btn-primary">+ Add Product</a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Listings</p>
                    <p className="text-2xl font-bold text-text-primary">{(products ?? []).length}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Total Stock</p>
                    <p className="text-2xl font-bold text-accent-blue">{totalStock} units</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-text-muted mb-1">Avg. Price</p>
                    <p className="text-2xl font-bold text-accent-green">{formatUSD(avgPrice)}</p>
                </div>
            </div>

            {/* Products Table */}
            <div className="card p-5">
                <h3 className="section-title mb-5">All Listings</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-text-muted text-left">
                                <th className="pb-3 font-medium">Title</th>
                                <th className="pb-3 font-medium">Description</th>
                                <th className="pb-3 font-medium">Price</th>
                                <th className="pb-3 font-medium">Stock</th>
                                <th className="pb-3 font-medium">Listed</th>
                                <th className="pb-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(products ?? []).map((product) => (
                                <tr key={product.id} className="table-row-hover">
                                    <td className="py-3 font-semibold text-text-primary max-w-[180px] truncate">{product.title}</td>
                                    <td className="py-3 text-text-muted max-w-[220px]">
                                        <span className="line-clamp-1">{product.description}</span>
                                    </td>
                                    <td className="py-3 text-accent-green font-semibold">{formatUSD(product.price_usd)}</td>
                                    <td className="py-3 text-text-primary">{product.quantity}</td>
                                    <td className="py-3 text-text-muted">{formatDate(product.created_at)}</td>
                                    <td className="py-3">
                                        {product.quantity > 0
                                            ? <span className="badge-green">Active</span>
                                            : <span className="badge-danger">Out of Stock</span>}
                                    </td>
                                </tr>
                            ))}
                            {(products ?? []).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-text-muted">
                                        No products yet. <a href="/dashboard/seller" className="text-accent-green hover:underline">Add your first product →</a>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
