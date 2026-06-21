import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { Plus } from '../components/Icons';

export function Purchases() {
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

  const pageSize = 20;

  useEffect(() => {
    document.title = 'Purchases — MediStock';
    fetchPurchases();
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
        unit_price: parseFloat((Math.random() * 50 + 5).toFixed(2)),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Purchases</h1>
            <p className="mt-2 text-sm text-slate-500">Manage purchase orders and track delivery status.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 w-fit"
          >
            <Plus className="w-4 h-4" />
            New Purchase
          </button>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="mt-2 text-2xl font-semibold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Confirmed</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{stats.confirmed}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Shipped</p>
          <p className="mt-2 text-2xl font-semibold text-purple-600">{stats.shipped}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Received</p>
          <p className="mt-2 text-2xl font-semibold text-green-600">{stats.received}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by medicine or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm"
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="received">Received</option>
        </select>
      </div>

      {notification && <Alert type="success">{notification}</Alert>}

      {/* Purchases Table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading purchases...</div>
        ) : paginatedPurchases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No purchase orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
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
                  <tr key={purchase.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-3 font-semibold">{purchase.id}</td>
                    <td className="px-6 py-3">{purchase.medicine_name}</td>
                    <td className="px-6 py-3">{purchase.supplier_name}</td>
                    <td className="px-6 py-3">{purchase.quantity}</td>
                    <td className="px-6 py-3 font-semibold text-primary">${purchase.total_cost.toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <select
                        value={purchase.status}
                        onChange={(e) => handleUpdateStatus(purchase.id, e.target.value)}
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
                      <button className="text-primary hover:underline text-xs font-semibold">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredPurchases.length > pageSize && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: Math.ceil(filteredPurchases.length / pageSize) }).map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`rounded px-3 py-1 text-sm ${
                currentPage === i + 1
                  ? 'bg-primary text-white'
                  : 'border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* New Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Purchase Order</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Supplier Name"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Medicine Name"
                value={formData.medicine_name}
                onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Unit Price"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
              />
              <input
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePurchase}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Create Order
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
