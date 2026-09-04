import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCart } from '../context/CartContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { formatMoney } from '../utils/money';
import { CheckCircle2 } from '../components/Icons';

const TAX_RATE = 0.05;

export function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { settings } = useAppSettings();
  const user = useSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const currency = settings.currencySymbol;

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    pincode: '',
    notes: '',
    paymentMethod: 'COD',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Secure Checkout — MediStock';
    if (items.length === 0) navigate('/cart', { replace: true });
  }, [items.length, navigate]);

  const taxAmount = subtotal * TAX_RATE;
  const grandTotal = subtotal + taxAmount;

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handlePlaceOrder = async () => {
    setError('');
    if (!form.name.trim() || !form.address.trim() || !form.city.trim() || !form.pincode.trim() || !form.phone.trim()) {
      setError('Please fill in recipient name, phone, address, city and PIN code.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        // Note: the server always re-resolves unit_price from the database
        // itself (never trusts client-sent prices) — see order.controller.js.
        // We still send it here so the payload/audit trail reflects what the
        // customer actually saw on screen.
        items: items.map((i) => ({ medicineId: i.medicineId, medicine_name: i.medicine_name, quantity: i.quantity, unit_price: i.unit_price })),
        customer: { ...form, whatsapp: form.whatsapp || form.phone },
        paymentMethod: form.paymentMethod,
        taxRate: TAX_RATE,
      };
      const { data } = await apiClient.post('/orders', payload);
      clearCart();
      navigate(`/orders/${data.data.orderNumber}`, { state: { justPlaced: true } });
    } catch (err) {
      console.error('Place order failed', err);
      setError(err?.response?.data?.message || 'Unable to place the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Secure Gateway"
        title="Secure Checkout"
        description="Confirm your delivery details, review the order, and continue to payment in a guided flow."
        image={PAGE_IMAGES.pillsBunch}
        imageAlt="Pharmacy shelf"
      />

      {error && <Alert type="danger">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal className="panel space-y-5 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Delivery / Recipient Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Recipient name</label>
              <input value={form.name} onChange={handleChange('name')} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={form.email} onChange={handleChange('email')} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
              <input value={form.phone} onChange={handleChange('phone')} placeholder="10-digit mobile number" className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">WhatsApp number (for invoice share)</label>
              <input value={form.whatsapp} onChange={handleChange('whatsapp')} placeholder="Defaults to phone number above" className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
              <textarea rows={2} value={form.address} onChange={handleChange('address')} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">City</label>
              <input value={form.city} onChange={handleChange('city')} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">PIN / postal code</label>
              <input value={form.pincode} onChange={handleChange('pincode')} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment method</label>
            <div className="flex flex-wrap gap-2">
              {['COD', 'UPI', 'Card', 'Insurance'].map((method) => {
                const isSelected = form.paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setForm((prev) => ({ ...prev, paymentMethod: method }))}
                    className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-white shadow-md shadow-primary/30 ring-2 ring-primary/30 ring-offset-1'
                        : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4" />}
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes (gift packaging, instructions, etc.)</label>
            <textarea rows={2} value={form.notes} onChange={handleChange('notes')} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </Reveal>

        <Reveal className="h-fit space-y-4 rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Order Overview</p>
          <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.medicineId} className="flex justify-between gap-2 text-sm">
                <span className="text-slate-200">{item.medicine_name} × {item.quantity}</span>
                <span className="font-semibold">{formatMoney(currency, item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-white/10 pt-3 text-sm text-slate-300">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(currency, subtotal)}</span></div>
            <div className="flex justify-between"><span>GST ({Math.round(TAX_RATE * 100)}%)</span><span>{formatMoney(currency, taxAmount)}</span></div>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-semibold">
            <span>Grand Total</span>
            <span className="text-emerald-300">{formatMoney(currency, grandTotal)}</span>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handlePlaceOrder}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Placing order…' : 'Confirm & Place Order'}
          </button>
          <Link to="/cart" className="block text-center text-xs font-semibold text-slate-300 hover:text-white">
            ← Back to cart
          </Link>
        </Reveal>
      </div>
    </div>
  );
}

export default Checkout;
