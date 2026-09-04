import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axios';
import { useAppSettings } from '../context/AppSettingsContext';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { RefreshCcw, Search } from '../components/Icons';
import { formatMoney } from '../utils/money';

const STATUS_OPTIONS = ['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const STATUS_STYLES = {
  Placed: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-sky-100 text-sky-700',
  Processing: 'bg-violet-100 text-violet-700',
  Shipped: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-rose-100 text-rose-700',
};
const POLL_MS = 8000;
const PAGE_SIZE = 20; // 20 orders per page, per request

export function Orders() {
  const role = useSelector((s) => s.auth.user?.role || 'User');
  const isAdmin = ['Admin', 'Manager'].includes(role);
  const { settings } = useAppSettings();
  const currency = settings.currencySymbol;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest'); // 'latest' | 'oldest'
  const [savingId, setSavingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, placed: 0, processing: 0, delivered: 0 });

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE, sort: sortOrder };
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const { data } = await apiClient.get('/orders', { params });
      setOrders(Array.isArray(data.data) ? data.data : []);
      if (data.pagination) setPagination(data.pagination);
      if (data.summary) setSummary(data.summary);
      setError('');
    } catch (err) {
      console.error('Load orders failed', err);
      setError('Unable to load orders.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filter, search, sortOrder, page]);

  useEffect(() => {
    document.title = isAdmin ? 'Order Management — MediStock' : 'My Orders — MediStock';
  }, [isAdmin]);

  // Any change to search/filter/sort should jump back to page 1 rather than
  // silently showing an out-of-range page of the new result set.
  useEffect(() => {
    setPage(1);
  }, [filter, search, sortOrder]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders({ silent: true }), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusChange = async (order, status) => {
    setSavingId(order._id);
    try {
      const { data } = await apiClient.patch(`/orders/${order._id}/status`, { status });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? data.data : o)));
    } catch (err) {
      console.error('Update status failed', err);
      setError(err?.response?.data?.message || 'Unable to update status.');
    } finally {
      setSavingId(null);
    }
  };

  const stats = summary;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isAdmin ? 'Order Management' : 'Billing'}
        title={isAdmin ? 'All Orders' : 'My Orders'}
        description={isAdmin ? 'Update fulfilment status — customers see the change reflected here automatically.' : 'Track every bill you have placed and revisit its invoice anytime.'}
        image={PAGE_IMAGES.shippingBoxes}
        imageAlt="Pharmacy shelf"
      />

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Orders', value: stats.total, color: '#0F766E' },
          { label: 'Awaiting Confirmation', value: stats.placed, color: '#D97706' },
          { label: 'In Progress', value: stats.processing, color: '#7C3AED' },
          { label: 'Delivered', value: stats.delivered, color: '#059669' },
        ].map((item) => (
          <div key={item.label} className="stat-tile" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: item.color }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </section>

      <Reveal className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ colorScheme: 'light' }} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ colorScheme: 'light' }} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="latest">Latest placed first</option>
          <option value="oldest">Oldest placed first</option>
        </select>
        <button type="button" onClick={() => fetchOrders()} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-primary/5">
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </Reveal>

      {error && <Alert type="danger">{error}</Alert>}

      <Reveal className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left">
                <th className="px-6 py-4 font-semibold">Order ID</th>
                {isAdmin && <th className="px-6 py-4 font-semibold">Customer</th>}
                <th className="px-6 py-4 font-semibold">Items</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Placed</th>
                <th className="px-6 py-4 font-semibold">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">No orders yet.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="border-b border-border transition-colors hover:bg-primary/5">
                    <td className="px-6 py-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
                    {isAdmin && <td className="px-6 py-3">{order.customer?.name}</td>}
                    <td className="px-6 py-3 text-muted-foreground">{order.items?.length} item{order.items?.length === 1 ? '' : 's'}</td>
                    <td className="px-6 py-3 font-semibold text-primary">{formatMoney(currency, order.grandTotal)}</td>
                    <td className="px-6 py-3">
                      {isAdmin ? (
                        <select
                          value={order.status}
                          disabled={savingId === order._id}
                          onChange={(e) => handleStatusChange(order, e.target.value)}
                          style={{ colorScheme: 'light' }}
                          className={`rounded px-3 py-1 text-xs font-semibold border-0 ${STATUS_STYLES[order.status] || 'bg-slate-100 text-slate-700'}`}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] || 'bg-slate-100 text-slate-700'}`}>{order.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <Link to={`/orders/${order.orderNumber}`} className="text-xs font-semibold text-primary hover:underline">View / Invoice</Link>
                        {isAdmin && (
                          <Link to={`/orders/${order.orderNumber}?edit=true`} className="text-xs font-semibold text-muted-foreground hover:text-primary hover:underline">Update order</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <p>
            {pagination.total === 0
              ? 'No orders'
              : `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.total, pagination.page * pagination.limit)} of ${pagination.total} orders`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="rounded-2xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-1 text-xs font-semibold text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-2xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export default Orders;
