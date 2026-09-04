import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { useAppSettings } from '../context/AppSettingsContext';
import { Plus } from '../components/Icons';

export function Purchases() {
  const { settings } = useAppSettings();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    supplier_name: '',
    medicine_name: '',
    quantity: 1,
    unit_price: 0,
    status: 'pending',
    expected_delivery: '',
  });
  const [editPurchase, setEditPurchase] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const pageSize = settings.defaultPageSize || 20;

  useEffect(() => {
    document.title = 'Purchases — MediStock';
    fetchPurchases();
    const onInv = () => fetchPurchases();
    window.addEventListener('inventory:changed', onInv);
    return () => window.removeEventListener('inventory:changed', onInv);
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/medicines');
      const mockPurchases = (Array.isArray(data?.data) ? data.data : []).slice(0, 25).map((med, idx) => ({
        id: `PO-${1001 + idx}`,
        supplier_name: ['MedSupply Co', 'PharmaCorp', 'HealthLabs'][idx % 3],
        medicine_name: med.medicine_name || med.name || 'Medicine',
        quantity: Math.floor(Math.random() * 100) + 10,
        unit_price: parseFloat((Math.random() * 400 + 50).toFixed(2)),
        total_cost: 0,
        status: ['pending', 'confirmed', 'shipped', 'received'][idx % 4],
        expected_delivery: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      })).map(p => ({ ...p, total_cost: p.quantity * p.unit_price }));
      setPurchases(mockPurchases);
    } catch (err) {
      console.error('Failed to fetch purchases', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchase = async () => {
    if (!formData.supplier_name || !formData.medicine_name || formData.quantity <= 0) {
      setNotification('Please fill in all required fields.');
      return;
    }
    try {
      const newPurchase = {
        id: `PO-${1000 + purchases.length + 1}`,
        ...formData,
        total_cost: formData.quantity * formData.unit_price,
        created_at: new Date().toISOString(),
      };
      setPurchases([newPurchase, ...purchases]);
      setNotification('Purchase order created successfully.');
      setFormData({ supplier_name: '', medicine_name: '', quantity: 1, unit_price: 0, status: 'pending', expected_delivery: '' });
      setShowModal(false);
    } catch (err) {
      setNotification('Failed to create purchase order.');
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    setPurchases(purchases.map(p => p.id === id ? { ...p, status: newStatus } : p));
    setNotification(`Purchase order updated to ${newStatus}.`);
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchSearch = p.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier_name.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || p.status === filter;
      return matchSearch && matchFilter;
    });
  }, [purchases, search, filter]);

  const paginatedPurchases = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(startIdx, startIdx + pageSize);
  }, [filteredPurchases, currentPage]);

  const stats = useMemo(() => {
    return {
      pending: purchases.filter(p => p.status === 'pending').length,
      confirmed: purchases.filter(p => p.status === 'confirmed').length,
      shipped: purchases.filter(p => p.status === 'shipped').length,
      received: purchases.filter(p => p.status === 'received').length,
    };
  }, [purchases]);

  const role = useSelector((s) => s.auth.user?.role || 'User');

  return (
    <div className="space-y-8">
      {/* Hero */}
      <PageHeader
        title="Purchase orders"
        description="Manage purchase orders and track delivery status from supplier to shelf."
        image={PAGE_IMAGES.warehouseShelves}
        imageAlt="Warehouse storage shelves"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            <Plus className="h-4 w-4" />
            New Purchase
          </button>
        }
      />

      {/* Stats — icon-free stat-tile row with a coloured left spine per status */}
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Pending', value: stats.pending, color: '#F59E0B', text: 'text-amber-600' },
          { label: 'Confirmed', value: stats.confirmed, color: '#059669', text: 'text-emerald-600' },
          { label: 'Shipped', value: stats.shipped, color: '#7C3AED', text: 'text-violet-600' },
          { label: 'Received', value: stats.received, color: '#10B981', text: 'text-emerald-600' },
        ].map((item, index) => (
          <Reveal key={item.label} delay={index * 60}>
            <div className="stat-tile" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: item.color }}>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${item.text}`}>{item.value}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Filters — single connected panel instead of loose inline inputs */}
      <Reveal as="section" className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by medicine or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          style={{ colorScheme: 'light' }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="received">Received</option>
        </select>
      </Reveal>

      {notification && <Alert type="success">{notification}</Alert>}

      {/* Purchases Table */}
      <Reveal as="div" className="panel overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading purchases...</div>
        ) : paginatedPurchases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No purchase orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-6 py-4 text-left font-semibold">PO#</th>
                  <th className="px-6 py-4 text-left font-semibold">Medicine</th>
                  <th className="px-6 py-4 text-left font-semibold">Supplier</th>
                  <th className="px-6 py-4 text-left font-semibold">Qty</th>
                  <th className="px-6 py-4 text-left font-semibold">Total</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Expected</th>
                  <th className="px-6 py-4 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-border transition-colors hover:bg-primary/5">
                    <td className="px-6 py-3 font-semibold">{purchase.id}</td>
                    <td className="px-6 py-3">{purchase.medicine_name}</td>
                    <td className="px-6 py-3">{purchase.supplier_name}</td>
                    <td className="px-6 py-3">{purchase.quantity}</td>
                    <td className="px-6 py-3 font-semibold text-primary">{settings.currencySymbol}{purchase.total_cost.toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <select
                        value={purchase.status}
                        onChange={(e) => handleUpdateStatus(purchase.id, e.target.value)}
                        style={{ colorScheme: 'light' }}
                        className={`rounded px-3 py-1 text-xs font-semibold border-0 ${
                          purchase.status === 'received' ? 'bg-green-100 text-green-700' :
                          purchase.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                          purchase.status === 'confirmed' ? 'bg-purple-100 text-purple-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="received">Received</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">{purchase.expected_delivery}</td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => setEditPurchase(purchase)}
                        className="text-primary hover:underline text-xs font-semibold"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>

      {/* Pagination */}
      {filteredPurchases.length > pageSize && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: Math.ceil(filteredPurchases.length / pageSize) }).map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                currentPage === i + 1
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-border hover:-translate-y-0.5 hover:bg-primary/5'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* New Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-emerald-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">New Purchase Order</h2>
              <button
                aria-label="Close"
                onClick={() => setShowModal(false)}
                className="rounded-md px-2 py-1 text-sm text-white hover:text-emerald-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier name</label>
                <input
                  type="text"
                  placeholder="e.g. Cipla Ltd."
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Medicine name</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg"
                  value={formData.medicine_name}
                  onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</label>
                <input
                  type="number"
                  placeholder="e.g. 200"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit price (INR)</label>
                <input
                  type="number"
                  placeholder="e.g. 12.50"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Expected delivery</label>
                <input
                  type="date"
                  value={formData.expected_delivery}
                  onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-foreground hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePurchase}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-green hover:bg-primary/90"
                >
                  Create Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-emerald-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Edit Purchase ({editPurchase.id})</h2>
              <button
                aria-label="Close"
                onClick={() => setEditPurchase(null)}
                className="rounded-md px-2 py-1 text-sm text-white hover:text-emerald-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-6">
              <input
                type="text"
                placeholder="Supplier Name"
                value={editPurchase.supplier_name || ''}
                onChange={(e) => setEditPurchase({ ...editPurchase, supplier_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground"
              />
              <input
                type="text"
                placeholder="Medicine Name"
                value={editPurchase.medicine_name || ''}
                onChange={(e) => setEditPurchase({ ...editPurchase, medicine_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={editPurchase.quantity || 0}
                onChange={(e) => setEditPurchase({ ...editPurchase, quantity: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground"
              />
              <input
                type="number"
                placeholder="Unit Price"
                step="0.01"
                value={editPurchase.unit_price || 0}
                onChange={(e) => setEditPurchase({ ...editPurchase, unit_price: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground"
              />
              <input
                type="date"
                value={editPurchase.expected_delivery || ''}
                onChange={(e) => setEditPurchase({ ...editPurchase, expected_delivery: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground"
              />
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" onChange={(e) => setEditPurchase({ ...editPurchase, applyToInventory: e.target.checked })} />
                <span>Apply received quantity to linked inventory (if found)</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditPurchase(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-foreground hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      // update local purchases state
                      setPurchases((prev) => prev.map((p) => (p.id === editPurchase.id ? { ...p, ...editPurchase, total_cost: (editPurchase.quantity || 0) * (editPurchase.unit_price || 0) } : p)));
                      // optionally apply to inventory
                      if (editPurchase.applyToInventory) {
                        try {
                          const { data } = await apiClient.get('/medicines');
                          const list = Array.isArray(data?.data) ? data.data : [];
                          const found = list.find((m) => String(m.medicine_name || '').toLowerCase() === String(editPurchase.medicine_name || '').toLowerCase());
                          if (found) {
                            const payload = { stock_quantity: Number(found.stock_quantity || 0) + Number(editPurchase.quantity || 0) };
                            await apiClient.put(`/medicines/${found._id}`, payload);
                            // notify other pages
                            try { window.dispatchEvent(new CustomEvent('inventory:changed')); } catch (e) {}
                          }
                        } catch (err) {
                          console.warn('Apply to inventory failed', err);
                        }
                      }
                      setNotification('Purchase updated successfully.');
                      setEditPurchase(null);
                    } catch (err) {
                      console.error('Update purchase failed', err);
                      setNotification('Unable to update purchase.');
                    }
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-green hover:bg-primary/90"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Purchases;