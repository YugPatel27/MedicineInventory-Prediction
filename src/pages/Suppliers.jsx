import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Phone, Mail, BarChart3 } from '../components/Icons';
import Alert from '../components/Alert';

const seedSuppliers = [
  { id: 1, name: 'MedSupply Co', email: 'orders@medsupplyco.com', phone: '+91 98765 10001', category: 'General medicines', city: 'Mumbai', lead_time: '3 days', rating: 4.8 },
  { id: 2, name: 'PharmaLink Distributors', email: 'sales@pharmalink.in', phone: '+91 98765 10002', category: 'Antibiotics', city: 'Pune', lead_time: '4 days', rating: 4.6 },
  { id: 3, name: 'LifeCare Wholesale', email: 'hello@lifecarewholesale.com', phone: '+91 98765 10003', category: 'OTC medicines', city: 'Delhi', lead_time: '2 days', rating: 4.7 },
  { id: 4, name: 'Wellness Pharma', email: 'support@wellnesspharma.in', phone: '+91 98765 10004', category: 'Supplements', city: 'Bengaluru', lead_time: '5 days', rating: 4.4 },
  { id: 5, name: 'CityMed Traders', email: 'info@citymedtraders.com', phone: '+91 98765 10005', category: 'Cardiac care', city: 'Hyderabad', lead_time: '3 days', rating: 4.5 },
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  category: '',
  city: '',
  lead_time: '',
  rating: 4.5,
};

export function Suppliers() {
  const [suppliers, setSuppliers] = useState(seedSuppliers);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    document.title = 'Suppliers - MediStock';
    setLoading(false);
  }, []);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.email, supplier.phone, supplier.category, supplier.city]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [suppliers, search]);

  const stats = useMemo(() => {
    return {
      total: suppliers.length,
      categories: new Set(suppliers.map((supplier) => supplier.category)).size,
      averageRating: (suppliers.reduce((sum, supplier) => sum + Number(supplier.rating || 0), 0) / suppliers.length).toFixed(1),
    };
  }, [suppliers]);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      category: supplier.category,
      city: supplier.city,
      lead_time: supplier.lead_time,
      rating: supplier.rating,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      setNotification('Supplier name is required.');
      return;
    }

    const payload = {
      ...formData,
      rating: Number(formData.rating) || 0,
    };

    if (editingId) {
      setSuppliers((current) => current.map((supplier) => (supplier.id === editingId ? { ...supplier, ...payload } : supplier)));
      setNotification('Supplier updated successfully.');
    } else {
      const nextId = Math.max(...suppliers.map((supplier) => supplier.id), 0) + 1;
      setSuppliers((current) => [{ id: nextId, ...payload }, ...current]);
      setNotification('Supplier added successfully.');
    }

    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this supplier?')) {
      setSuppliers((current) => current.filter((supplier) => supplier.id !== id));
      setNotification('Supplier removed.');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Suppliers</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Supplier management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Track supplier contacts, categories, lead time, and delivery quality. The list starts with 5 temporary suppliers so the page is useful right away.
            </p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add supplier
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total suppliers</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Product groups</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.categories}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Average rating</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.averageRating}/5</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Search suppliers</h2>
            <p className="mt-2 text-sm text-muted-foreground">Find suppliers by name, city, category, email, or phone.</p>
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers..."
              className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {notification && <div className="mt-4"><Alert type="success">{notification}</Alert></div>}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="rounded-3xl border border-border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{supplier.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{supplier.category} - {supplier.city}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(supplier)} className="rounded-2xl border border-border p-2 text-muted-foreground hover:bg-primary/5" title="Edit supplier">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(supplier.id)} className="rounded-2xl border border-border p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" title="Delete supplier">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{supplier.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{supplier.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Lead time: {supplier.lead_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Rating: {supplier.rating}/5</span>
                </div>
              </div>
            </div>
          ))}

          {!loading && filteredSuppliers.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground lg:col-span-2">
              No suppliers found.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Supplier table</h2>
        <p className="mt-2 text-sm text-muted-foreground">A compact view for quick review and purchase planning.</p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-slate-50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Lead time</th>
                <th className="px-4 py-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={`row-${supplier.id}`} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-foreground">{supplier.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.city}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.lead_time}</td>
                  <td className="px-4 py-3 font-semibold text-primary">{supplier.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-foreground">{editingId ? 'Edit supplier' : 'Add supplier'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Enter contact and delivery details used by the pharmacy team.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Supplier name" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
              <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email address" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
              <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone number" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
              <input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Product category" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
              <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="City" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
              <input value={formData.lead_time} onChange={(e) => setFormData({ ...formData, lead_time: e.target.value })} placeholder="Lead time" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
              <input value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: e.target.value })} type="number" min="0" max="5" step="0.1" placeholder="Rating" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm md:col-span-2" />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/5">
                Cancel
              </button>
              <button onClick={handleSave} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90">
                {editingId ? 'Update supplier' : 'Save supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Suppliers;
