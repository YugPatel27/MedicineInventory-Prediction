import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiClient } from '../api/axios';
import { useAppSettings } from '../context/AppSettingsContext';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { OrderStatusStepper } from '../components/OrderStatusStepper';
import { downloadInvoicePdf, openInvoicePdf, invoicePdfBlob } from '../utils/invoicePdf';
import { BUSINESS_INFO, BANK_DETAILS } from '../utils/invoiceBrand';
import { formatMoney, formatInvoiceMoney, amountToWords } from '../utils/money';
import { CheckCircle2, Download, Printer, Copy, MessageCircle, RefreshCcw, Edit2, X } from '../components/Icons';

const STATUS_OPTIONS = ['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const POLL_MS = 7000;

export function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const justPlaced = Boolean(location.state?.justPlaced);
  const { settings } = useAppSettings();
  const role = useSelector((s) => s.auth.user?.role || 'User');
  const isAdmin = ['Admin', 'Manager'].includes(role);
  const currency = settings.currencySymbol;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvoice, setShowInvoice] = useState(justPlaced);
  const [statusSaving, setStatusSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastStatusRef = useRef(null);
  const [statusJustChanged, setStatusJustChanged] = useState(false);

  // Admin-only "update order" form — opened either from the pencil button
  // below or by landing here with ?edit=true (e.g. from the Orders list).
  const [editing, setEditing] = useState(isAdmin && searchParams.get('edit') === 'true');
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchOrder = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await apiClient.get(`/orders/${id}`);
      const next = data.data;
      if (lastStatusRef.current && lastStatusRef.current !== next.status) {
        setStatusJustChanged(true);
        setTimeout(() => setStatusJustChanged(false), 4000);
      }
      lastStatusRef.current = next.status;
      setOrder(next);
      setError('');
    } catch (err) {
      console.error('Load order failed', err);
      setError(err?.response?.data?.message || 'Unable to load order');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    document.title = 'Order — MediStock';
    fetchOrder();
    // Poll so a status change made by Admin shows up here without a manual refresh.
    const interval = setInterval(() => fetchOrder({ silent: true }), POLL_MS);
    const onFocus = () => fetchOrder({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchOrder]);

  const handleStatusChange = async (newStatus) => {
    setStatusSaving(true);
    try {
      const { data } = await apiClient.patch(`/orders/${order._id}/status`, { status: newStatus });
      setOrder(data.data);
      lastStatusRef.current = data.data.status;
    } catch (err) {
      console.error('Status update failed', err);
      setError(err?.response?.data?.message || 'Unable to update order status.');
    } finally {
      setStatusSaving(false);
    }
  };

  useEffect(() => {
    if (order && editing) {
      setEditForm({
        name: order.customer?.name || '',
        phone: order.customer?.phone || '',
        email: order.customer?.email || '',
        address: order.customer?.address || '',
        city: order.customer?.city || '',
        pincode: order.customer?.pincode || '',
        notes: order.customer?.notes || '',
        paymentMethod: order.paymentMethod || 'COD',
      });
    }
  }, [order, editing]);

  const openEdit = () => {
    setEditing(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('edit', 'true');
      return next;
    }, { replace: true });
  };

  const closeEdit = () => {
    setEditing(false);
    setEditError('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('edit');
      return next;
    }, { replace: true });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm) return;
    setEditSaving(true);
    setEditError('');
    try {
      const { data } = await apiClient.patch(`/orders/${order._id}`, {
        customer: {
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          address: editForm.address,
          city: editForm.city,
          pincode: editForm.pincode,
          notes: editForm.notes,
        },
        paymentMethod: editForm.paymentMethod,
      });
      setOrder(data.data);
      closeEdit();
    } catch (err) {
      console.error('Update order failed', err);
      setEditError(err?.response?.data?.message || 'Unable to update order');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy order ID:', order.orderNumber);
    }
  };

  const handleShareWhatsApp = async () => {
    const number = (order.customer?.whatsapp || order.customer?.phone || '').replace(/\D/g, '');
    const message =
      `Invoice ${order.orderNumber} from MediStock\n` +
      `Total: ${formatMoney(currency, order.grandTotal)}\n` +
      `Status: ${order.status}\n` +
      `Items: ${order.items.map((i) => `${i.medicine_name} x${i.quantity}`).join(', ')}`;

    // Where the browser supports native file sharing (most mobile browsers),
    // share the actual invoice PDF — the person still picks WhatsApp + the
    // contact themselves from the OS share sheet, since no browser API can
    // silently deliver a file to a specific WhatsApp number.
    try {
      const blob = await invoicePdfBlob(order, { currencySymbol: currency });
      const file = new File([blob], `Invoice-${order.orderNumber}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${order.orderNumber}`, text: message });
        return;
      }
    } catch (err) {
      // fall through to the wa.me link below
    }

    const url = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');
  };

  if (loading) {
    return <div className="panel p-10 text-center text-muted-foreground">Loading order…</div>;
  }
  if (error && !order) {
    return <Alert type="danger">{error}</Alert>;
  }
  if (!order) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order"
        title={justPlaced ? 'Order Confirmed 🎉' : `Order ${order.orderNumber}`}
        description={justPlaced ? `Thank you for your order. A confirmation goes to ${order.customer?.email || order.customer?.phone}.` : 'Track fulfilment status and manage the invoice for this order.'}
        image={PAGE_IMAGES.packageBoxes}
        imageAlt="Pharmacy shelf"
      />

      {error && <Alert type="warning">{error}</Alert>}
      {statusJustChanged && (
        <Alert type="success">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Status just updated to <strong>{order.status}</strong>.</span>
        </Alert>
      )}

      <Reveal className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Order Status</p>
            <p className="mt-1 text-sm text-muted-foreground">Order ID <span className="font-mono font-semibold text-foreground">{order.orderNumber}</span></p>
          </div>
          <button
            type="button"
            onClick={() => fetchOrder()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-primary/5"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <OrderStatusStepper status={order.status} />

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Admin: update status</span>
            <select
              value={order.status}
              disabled={statusSaving}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ colorScheme: 'light' }}
              className="rounded-lg border-0 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {statusSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
            <span className="text-xs text-muted-foreground">Customers see this change automatically within a few seconds.</span>
            <button
              type="button"
              onClick={openEdit}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
            >
              <Edit2 className="h-3.5 w-3.5" /> Update order details
            </button>
          </div>
        )}

        {isAdmin && editing && editForm && (
          <form onSubmit={handleEditSave} className="space-y-4 rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Update order details</p>
              <button type="button" onClick={closeEdit} className="rounded-lg p-1 text-muted-foreground hover:bg-slate-100" aria-label="Close edit form">
                <X className="h-4 w-4" />
              </button>
            </div>
            {editError && <Alert type="danger">{editError}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Recipient name</label>
                <input name="name" value={editForm.name} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Phone</label>
                <input name="phone" value={editForm.phone} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
                <input name="email" value={editForm.email} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Payment method</label>
                <select name="paymentMethod" value={editForm.paymentMethod} onChange={handleEditChange} style={{ colorScheme: 'light' }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="COD">Cash on Delivery</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="NetBanking">Net Banking</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Address</label>
                <input name="address" value={editForm.address} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">City</label>
                <input name="city" value={editForm.city} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Pincode</label>
                <input name="pincode" value={editForm.pincode} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Notes</label>
                <input name="notes" value={editForm.notes} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeEdit} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={editSaving} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal className="panel space-y-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Delivery Address</p>
          <p className="font-semibold">{order.customer?.name}</p>
          <p className="text-sm text-muted-foreground">{order.customer?.address}</p>
          <p className="text-sm text-muted-foreground">{order.customer?.city} — {order.customer?.pincode}</p>
          <p className="text-sm text-muted-foreground">{order.customer?.phone}</p>
          <p className="text-sm text-muted-foreground">{order.customer?.email}</p>
        </Reveal>
        <Reveal className="panel space-y-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Payment Details</p>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Method</span><span className="font-semibold">{order.paymentMethod}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><span className="font-semibold">{order.paymentStatus}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Order date</span><span className="font-semibold">{new Date(order.createdAt).toLocaleDateString()}</span></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span className="text-primary">{formatMoney(currency, order.grandTotal)}</span></div>
        </Reveal>
      </div>

      <Reveal className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInvoice((v) => !v)}
            className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800"
          >
            {showInvoice ? '↑ Hide Invoice' : '📄 Show Invoice'}
          </button>
          <Link to="/orders" className="rounded-2xl border border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide hover:bg-primary/5">My Orders</Link>
          <Link to="/inventory" className="rounded-2xl border border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide hover:bg-primary/5">Continue Shopping</Link>
        </div>

        {showInvoice && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={handleCopyId} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-primary/5">
                <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Copy Order ID'}
              </button>
              <button onClick={() => openInvoicePdf(order, { currencySymbol: currency })} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-primary/5">
                <Printer className="h-3.5 w-3.5" /> Print Invoice
              </button>
              <button onClick={() => downloadInvoicePdf(order, { currencySymbol: currency })} className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90">
                <Download className="h-3.5 w-3.5" /> Download PDF
              </button>
              <button onClick={handleShareWhatsApp} className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
              </button>
            </div>

            {/* Themed invoice preview — tax-invoice layout: business identity + GST/PAN,
                Bill To / Order Details, line items, bank details + totals, terms, signature. */}
            <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-xl font-bold text-emerald-800">{BUSINESS_INFO.name}</p>
                  <p className="text-xs italic text-muted-foreground">{BUSINESS_INFO.tagline}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{BUSINESS_INFO.addressLine}</p>
                  <p className="text-xs text-muted-foreground">Contact: {BUSINESS_INFO.contactLine}</p>
                  <p className="text-xs text-muted-foreground">{BUSINESS_INFO.gst} | {BUSINESS_INFO.pan}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Tax Invoice</p>
                  <p className="font-mono text-sm font-bold text-emerald-800">INV-{order.orderNumber}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Invoice Date</p>
                  <p className="text-xs font-semibold text-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid gap-4 border-b border-border py-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bill To</p>
                  <p className="mt-1 font-semibold">{order.customer?.name}</p>
                  <p className="text-muted-foreground">{order.customer?.address}</p>
                  <p className="text-muted-foreground">{order.customer?.city}, {order.customer?.pincode}</p>
                  <p className="text-muted-foreground">{order.customer?.phone}</p>
                  <p className="text-muted-foreground">{order.customer?.email}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order Details</p>
                  <p className="mt-1 text-muted-foreground">Place of Supply: <span className="font-semibold text-foreground">{BUSINESS_INFO.placeOfSupply}</span></p>
                  <p className="text-muted-foreground">Payment Mode: <span className="font-semibold text-foreground">{order.paymentMethod}</span></p>
                  <p className="text-muted-foreground">Order Status: <span className="font-semibold text-foreground">{order.status}</span></p>
                  <p className="text-muted-foreground">Payment Status: <span className="font-semibold text-foreground">{order.paymentStatus}</span></p>
                </div>
              </div>

              <div className="overflow-x-auto py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-800 text-left text-xs uppercase tracking-wide text-white">
                      <th className="rounded-l-lg px-3 py-2">#</th>
                      <th className="px-3 py-2">Medicine Description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="rounded-r-lg px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={item.medicine_id} className="border-b border-border/60">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2">
                          {item.medicine_name}
                          {item.batch_number && <span className="ml-2 text-xs text-muted-foreground">Batch {item.batch_number}</span>}
                        </td>
                        <td className="px-3 py-2">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatInvoiceMoney(currency, item.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatInvoiceMoney(currency, item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order Journey — full cart-to-delivery timeline, mirrored in the PDF. */}
              <div className="border-t border-border py-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order Journey</p>
                <div className="space-y-1.5">
                  {(order.statusHistory && order.statusHistory.length > 0
                    ? order.statusHistory
                    : [{ status: order.status || 'Placed', changedAt: order.createdAt, changedByName: order.placedByName || '—' }]
                  ).map((h, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
                      <span className="font-semibold text-foreground">{h.status || '—'}</span>
                      <span className="text-muted-foreground">{h.changedAt ? new Date(h.changedAt).toLocaleString() : '—'}</span>
                      <span className="text-muted-foreground">{h.changedByName || '—'}</span>
                      {h.note && <span className="w-full text-muted-foreground italic">Note: {h.note}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 border-t border-border pt-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Our Bank Details</p>
                  <div className="mt-2 space-y-1 rounded-xl bg-muted/40 p-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Bank Name</span><span className="font-semibold text-foreground">{BANK_DETAILS.bankName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-semibold text-foreground">{BANK_DETAILS.branch}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Account No.</span><span className="font-semibold text-foreground">{BANK_DETAILS.accountNo}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">IFSC Code</span><span className="font-semibold text-foreground">{BANK_DETAILS.ifsc}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatInvoiceMoney(currency, order.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GST ({Math.round((order.taxRate || 0) * 100)}%)</span><span>{formatInvoiceMoney(currency, order.taxAmount)}</span></div>
                    <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-primary"><span>Total Amount</span><span>{formatInvoiceMoney(currency, order.grandTotal)}</span></div>
                  </div>
                  <p className="mt-2 text-[10.5px] italic text-muted-foreground">Amount in words: {amountToWords(order.grandTotal)}</p>
                </div>
              </div>

              <p className="mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Terms &amp; Conditions:</span> {BUSINESS_INFO.terms}
              </p>

              <div className="mt-8 flex items-end justify-between text-[11px] text-muted-foreground">
                <p>Invoice generated on {new Date().toLocaleDateString()}</p>
                <div className="text-right">
                  <p className="mb-1 font-semibold text-foreground">For {BUSINESS_INFO.name}</p>
                  <p className="font-serif text-2xl italic text-emerald-800" style={{ fontFamily: "'Brush Script MT', cursive" }}>{BUSINESS_INFO.signatoryName}</p>
                  <p className="border-t border-border pt-1 italic">{BUSINESS_INFO.signatoryName} — {BUSINESS_INFO.signatoryTitle}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Reveal>
    </div>
  );
}

export default OrderDetail;
