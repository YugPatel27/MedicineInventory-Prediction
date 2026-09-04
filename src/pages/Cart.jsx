import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { PageHeader } from '../components/PageHeader';
import { Reveal } from '../components/Reveal';
import { PAGE_IMAGES } from '../assets/pageImages';
import { Plus, Minus, Trash2, ShoppingCart } from '../components/Icons';
import { formatMoney } from '../utils/money';

const TAX_RATE = 0.05;

export function Cart() {
  const { items, updateQuantity, removeFromCart, subtotal } = useCart();
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const currency = settings.currencySymbol;

  useEffect(() => {
    document.title = 'Your Cart — MediStock';
  }, []);

  const taxAmount = subtotal * TAX_RATE;
  const grandTotal = subtotal + taxAmount;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Your Selection"
        description="Review the medicines you've added, adjust quantities, and move to secure checkout when you're ready."
        image={PAGE_IMAGES.pillsClose}
        imageAlt="Pharmacy shelf"
        actions={
          <Link
            to="/inventory"
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            Back to Inventory
          </Link>
        }
      />

      {items.length === 0 ? (
        <Reveal className="panel flex flex-col items-center gap-3 p-14 text-center">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-semibold">Your cart is empty</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Add medicines from the Inventory page to start a new bill.
          </p>
          <Link to="/inventory" className="mt-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
            Browse Inventory
          </Link>
        </Reveal>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => (
              <Reveal key={item.medicineId} className="panel flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{item.medicine_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {item.medicine_id} {item.batch_number ? `· Batch ${item.batch_number}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatMoney(currency, item.unit_price)} / unit · {item.stock_quantity} in stock</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-white px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.medicineId, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground hover:bg-primary/10"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.medicineId, Math.min(item.quantity + 1, item.stock_quantity || item.quantity + 1))}
                      disabled={item.quantity >= item.stock_quantity}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="w-24 text-right font-semibold text-primary">{formatMoney(currency, item.unit_price * item.quantity)}</p>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.medicineId)}
                    className="rounded-xl border border-border p-2 text-rose-600 hover:bg-rose-50"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="panel h-fit space-y-4 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Order Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatMoney(currency, subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST ({Math.round(TAX_RATE * 100)}%)</span><span className="font-medium">{formatMoney(currency, taxAmount)}</span></div>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Total Payable</span>
              <span className="text-primary">{formatMoney(currency, grandTotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Proceed to Checkout →
            </button>
            <Link to="/inventory" className="block text-center text-sm font-semibold text-primary hover:underline">
              Continue Shopping
            </Link>
          </Reveal>
        </div>
      )}
    </div>
  );
}

export default Cart;
