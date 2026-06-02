import Link from 'next/link'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [ordersResult, enquiriesResult, productsResult] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
    supabase.from('enquiries').select('*', { count: 'exact' }),
    supabase.from('products').select('*', { count: 'exact' }),
  ])

  const ordersCount = ordersResult.count || 0
  const enquiriesCount = enquiriesResult.count || 0
  const productsCount = productsResult.count || 0
  const ordersData = ordersResult.data || []

  const revenue = ordersData
    .filter((o: any) => o.status !== 'pending' && o.status !== 'cancelled')
    .reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)

  return (
    <AdminLayout activeTab="dashboard">
      <header className="flex justify-between items-end border-b border-gray-100 pb-12">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif italic text-brand-dark leading-none">Welcome back.</h1>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.5em] font-medium">Control Center • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link href="/" className="px-8 py-3 border border-brand-red/20 text-[10px] uppercase tracking-[0.4em] text-brand-red font-black rounded-full hover:bg-brand-red hover:text-white transition-all">
          Live Site
        </Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-12">
        {[
          { label: 'Total Volume', value: ordersCount, suffix: ' Sales', color: 'text-brand-dark' },
          { label: 'Net Revenue', value: `₹${revenue.toLocaleString('en-IN')}`, suffix: '', color: 'text-brand-red' },
          { label: 'Open Inquiries', value: enquiriesCount, suffix: ' Threads', color: 'text-brand-dark' },
          { label: 'Active Items', value: productsCount, suffix: ' SKUs', color: 'text-brand-dark' },
        ].map((stat, i) => (
          <div key={i} className="space-y-4 group cursor-default">
            <p className="text-[10px] uppercase tracking-[0.5em] text-gray-400 group-hover:text-brand-red transition-colors">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-5xl font-light tracking-tighter ${stat.color}`}>{stat.value}</p>
              <span className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">{stat.suffix}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-sm border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-[11px] uppercase tracking-[0.5em] font-black text-brand-dark">Audit Logs & Activity</h3>
          <div className="flex gap-4">
            <button className="text-[9px] uppercase tracking-widest text-gray-400 hover:text-brand-red transition-colors">Export .CSV</button>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {ordersData.length === 0 ? (
            <div className="p-24 text-center space-y-4">
              <p className="text-gray-200 text-6xl font-serif italic opacity-50">Nothing yet.</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Waiting for first connection</p>
            </div>
          ) : (
            ordersData.map((order: any) => (
              <div key={order.id} className="px-10 py-8 flex justify-between items-center hover:bg-gray-50 transition-all group">
                <div className="space-y-2">
                  <p className="text-lg font-serif italic text-brand-dark group-hover:text-brand-red transition-colors">{order.buyer_name}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-[0.4em] font-bold">{new Date(order.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex gap-16 items-center">
                  <span className={`text-[9px] uppercase tracking-[0.4em] px-5 py-2 rounded-full font-black border ${
                    order.status === 'confirmed' ? 'border-green-100 text-green-700 bg-green-50' :
                    order.status === 'pending' ? 'border-yellow-100 text-yellow-700 bg-yellow-50' :
                    'border-gray-100 text-gray-400 bg-gray-50'
                  }`}>
                    {order.status}
                  </span>
                  <p className="text-2xl font-light text-brand-dark tracking-tighter w-32 text-right">₹{(order.total_amount || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AdminLayout>
  )
}
