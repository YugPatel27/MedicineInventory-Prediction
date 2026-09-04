import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axios';
import { SEO } from '../components/SEO';
import Alert from '../components/Alert';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { Trash2 } from '../components/Icons';

export function Admin() {
  const role = useSelector((state) => state.auth.user?.role || 'User');
  const [logs, setLogs] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [newOrderNotice, setNewOrderNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const [expandedLogId, setExpandedLogId] = useState(null);
  const knownOrderIds = React.useRef(new Set());
  const ordersLoaded = React.useRef(false);

  useEffect(() => {
    document.title = 'Admin Panel — MediStock';
  }, []);

  const fetchLogs = async () => {
    if (role !== 'Admin') {
      setLoading(false);
      setError('Admin access is required to view audit logs.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/logs?limit=100');
      setLogs(data.data || []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
      setError(err?.response?.data?.message || 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [role]);

  useEffect(() => {
    if (role !== 'Admin') return undefined;

    let active = true;
    const fetchRecentOrders = async () => {
      try {
        const { data } = await apiClient.get('/orders', { params: { limit: 8, sort: 'latest' } });
        if (!active) return;
        const orders = Array.isArray(data?.data) ? data.data : [];
        const newOrders = orders.filter((order) => order._id && !knownOrderIds.current.has(order._id));
        if (ordersLoaded.current && newOrders.length > 0) {
          const newest = newOrders[0];
          setNewOrderNotice(newest);
        }
        orders.forEach((order) => {
          if (order._id) knownOrderIds.current.add(order._id);
        });
        ordersLoaded.current = true;
        setRecentOrders(orders);
      } catch (err) {
        console.error('Failed to load recent orders for admin notification', err);
      }
    };

    fetchRecentOrders();
    const interval = setInterval(fetchRecentOrders, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [role]);

  const handleDeleteLog = async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return;
    setDeletingId(id);
    setError('');
    setMessage('');
    try {
      await apiClient.delete(`/admin/logs/${id}`);
      // Update both the database (via the API call above) and the
      // frontend list in the same action, so the row disappears immediately.
      setLogs((prev) => prev.filter((log) => log._id !== id));
      if (expandedLogId === id) setExpandedLogId(null);
      setMessage('Log entry deleted.');
    } catch (err) {
      console.error('Failed to delete audit log', err);
      setError(err?.response?.data?.message || 'Unable to delete this log.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllLogs = async () => {
    if (logs.length === 0) return;
    if (!window.confirm('Delete ALL audit logs? This cannot be undone.')) return;
    setClearing(true);
    setError('');
    setMessage('');
    try {
      await apiClient.delete('/admin/logs');
      setLogs([]);
      setExpandedLogId(null);
      setMessage('All logs cleared.');
    } catch (err) {
      console.error('Failed to clear audit logs', err);
      setError(err?.response?.data?.message || 'Unable to clear logs.');
    } finally {
      setClearing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return logs;
    return logs.filter((log) =>
      [log.action, log.target, log.userEmail, log.user?.name, log.ip, JSON.stringify(log.details)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [filter, logs]);

  if (role !== 'Admin') {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Admin"
          title="Admin access required"
          description="Your current account cannot view system audit logs. Sign in with an Admin account to continue."
          image={PAGE_IMAGES.warehousePallets}
          imageAlt="Stocked pharmacy medicine shelf"
          tone="slate"
        />
        <Alert type="danger">This area is restricted to Admin users.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SEO title="Admin — MediStock" description="Manage audit logs and admin activity for MediStock." url="/admin" />
      <PageHeader
        eyebrow="Admin"
        title="Activity logs & system audit"
        description="Review recent admin actions, API activity, and audit events for security & compliance."
        image={PAGE_IMAGES.warehousePallets}
        imageAlt="Stocked pharmacy medicine shelf"
        tone="slate"
      />

      {newOrderNotice && (
        <Alert type="success" title="New order received">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {newOrderNotice.orderNumber} from {newOrderNotice.customer?.name || 'customer'} for {newOrderNotice.items?.length || 0} item(s).
            </span>
            <Link
              to={`/orders/${newOrderNotice.orderNumber}`}
              onClick={() => setNewOrderNotice(null)}
              className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              View order
            </Link>
          </div>
        </Alert>
      )}

      <section className="panel-accent p-5" data-accent="teal">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow-tag">Order monitor</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Recent customer orders</h2>
          </div>
          <span className="text-xs text-muted-foreground">Updates automatically every 8 seconds</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recentOrders.slice(0, 4).map((order) => (
            <Link
              key={order._id}
              to={`/orders/${order.orderNumber}`}
              className="rounded-2xl border border-border bg-background p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{order.orderNumber}</span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">{order.status}</span>
              </div>
              <p className="mt-2 truncate text-sm text-muted-foreground">{order.customer?.name || 'Customer'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{order.items?.length || 0} item(s) · {new Date(order.createdAt).toLocaleString()}</p>
            </Link>
          ))}
          {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">No customer orders yet.</p>}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow-tag">Audit logs</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Recent user and system activity</h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
            <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-white px-4 py-2">
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter logs"
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="button"
              onClick={handleClearAllLogs}
              disabled={clearing || logs.length === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {clearing ? 'Clearing...' : 'Clear all logs'}
            </button>
          </div>
        </div>

        {error && <div className="px-5 pt-4"><Alert type="danger">{error}</Alert></div>}
        {message && <div className="px-5 pt-4"><Alert type="success">{message}</Alert></div>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-background/80 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading audit logs...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No activities found.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <React.Fragment key={log._id}>
                    <tr
                      className="hover:bg-primary/5 transition-colors cursor-pointer"
                      onClick={() => setExpandedLogId(expandedLogId === log._id ? null : log._id)}
                    >
                      <td className="px-4 py-3 text-slate-700">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600">{log.user?.name || log.userEmail || 'System'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.target || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{log.ip}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[18rem]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate block font-mono text-xs bg-slate-50 p-1 rounded border border-slate-100 flex-1">
                            {JSON.stringify(log.details || {})}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline shrink-0"
                          >
                            {expandedLogId === log._id ? 'Hide' : 'View'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLog(log._id);
                          }}
                          disabled={deletingId === log._id}
                          aria-label="Delete log entry"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === log._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                    {expandedLogId === log._id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Audit Payload</p>
                            <pre className="text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap font-mono p-3 bg-slate-50 rounded-xl border">
                              {JSON.stringify(log, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}