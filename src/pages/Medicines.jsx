import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/axios';
import { Search, Database, Clock3, ShieldCheck, BarChart3 } from '../components/Icons';

function getStatus(medicine) {
  const stock = Number(medicine.stock_quantity || 0);
  const expiryDate = medicine.expiry_date ? new Date(medicine.expiry_date) : null;
  const expiryDays = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  if (stock === 0) return 'Out of stock';
  if (stock <= 10) return 'Low stock';
  if (expiryDays !== null && expiryDays <= 30) return 'Expiring soon';
  return 'Healthy';
}

export function Medicines() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = 'Medicines - MediStock';
    const load = async () => {
      try {
        const { data } = await apiClient.get('/medicines');
        setItems(data?.data || []);
      } catch (error) {
        console.error('Failed to load medicines', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((medicine) =>
      [medicine.medicine_id, medicine.medicine_name, medicine.generic_name, medicine.category, medicine.batch_number]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const totalStock = filteredItems.reduce((sum, medicine) => sum + Number(medicine.stock_quantity || 0), 0);
    const outOfStock = filteredItems.filter((medicine) => Number(medicine.stock_quantity || 0) === 0).length;
    const lowStock = filteredItems.filter((medicine) => Number(medicine.stock_quantity || 0) > 0 && Number(medicine.stock_quantity || 0) <= 10).length;
    const expiringSoon = filteredItems.filter((medicine) => {
      if (!medicine.expiry_date) return false;
      const days = Math.ceil((new Date(medicine.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    }).length;

    return { total: filteredItems.length, totalStock, outOfStock, lowStock, expiringSoon };
  }, [filteredItems]);

  const summaryCards = [
    { label: 'Total medicines', value: stats.total, icon: Database, tone: 'bg-primary/10 text-primary' },
    { label: 'Total stock', value: stats.totalStock, icon: BarChart3, tone: 'bg-sky-100 text-sky-700' },
    { label: 'Expiring soon', value: stats.expiringSoon, icon: Clock3, tone: 'bg-amber-100 text-amber-700' },
    { label: 'Out of stock', value: stats.outOfStock, icon: ShieldCheck, tone: 'bg-rose-100 text-rose-700' },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Medicines</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Medicine inventory</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              A simple medicine list with search, stock counts, and expiry indicators for quick pharmacy review.
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by medicine, category, or batch"
              className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm uppercase tracking-[0.3em] text-muted-foreground">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Inventory list</h2>
            <p className="mt-2 text-sm text-muted-foreground">One row per medicine with the most important stock fields.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">{filteredItems.length} items</span>
        </div>

        <div className="mt-6 overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading medicines...</div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((medicine) => (
                  <tr key={medicine._id || medicine.medicine_id} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium text-foreground">{medicine.medicine_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{medicine.medicine_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{medicine.category || 'General'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{medicine.batch_number || 'N/A'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{medicine.expiry_date ? new Date(medicine.expiry_date).toLocaleDateString() : 'No date'}</td>
                    <td className="px-4 py-3 font-semibold text-primary">{medicine.stock_quantity ?? 0}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getStatus(medicine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default Medicines;
