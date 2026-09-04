import React, { useState } from 'react';
import { apiClient } from '../api/axios';

export function SmartMedicineEntry({ onClose = () => {}, onSuccess = () => {}, initialData = null }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const createDefaultFormData = () => ({
    medicine_id: `MED-${Math.floor(Math.random() * 10000)}`,
    medicine_name: '',
    generic_name: '',
    dosage: '',
    manufacturer: '',
    batch_number: `BAT-${Math.floor(Math.random() * 10000)}`,
    category: '',
    purchase_date: '',
    manufacturing_date: '',
    stock_quantity: 0,
    expiry_date: '',
    unit_cost: 0,
    unit_price: 0,
    dosage_form: '',
    strength: '',
    storage_requirements: 'Room Temperature',
  });

  const [formData, setFormData] = useState(createDefaultFormData());
  const isEditing = Boolean(initialData && initialData._id);

  const formatDateValue = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        medicine_id: initialData.medicine_id || `MED-${Math.floor(Math.random() * 10000)}`,
        medicine_name: initialData.medicine_name || '',
        generic_name: initialData.generic_name || '',
        dosage: initialData.dosage || '',
        manufacturer: initialData.manufacturer || '',
        batch_number: initialData.batch_number || `BAT-${Math.floor(Math.random() * 10000)}`,
        category: initialData.category || '',
        purchase_date: formatDateValue(initialData.purchase_date),
        manufacturing_date: formatDateValue(initialData.manufacturing_date),
        stock_quantity: Number(initialData.stock_quantity || 0),
        expiry_date: formatDateValue(initialData.expiry_date),
        unit_cost: Number(initialData.unit_cost || 0),
        unit_price: Number(initialData.unit_price || 0),
        dosage_form: initialData.dosage_form || '',
        strength: initialData.strength || '',
        storage_requirements: initialData.storage_requirements || 'Room Temperature',
      });
    } else {
      setFormData(createDefaultFormData());
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const validateForm = (f) => {
    if (!String(f.medicine_name).trim()) return 'Medicine name is required.';
    if (!f.expiry_date) return 'Expiry date is required.';
    if (Number(f.stock_quantity) < 0) return 'Stock quantity must be 0 or greater.';
    if (Number(f.unit_price) < 0) return 'Selling price must be 0 or greater.';
    if (Number(f.unit_price) <= 0) return 'Selling price is required so this medicine can be billed correctly in Cart, Orders and Invoices.';
    return null;
  };

  const sanitize = (f) => {
    const copy = { ...f };
    for (const k of Object.keys(copy)) {
      if (typeof copy[k] === 'string') copy[k] = copy[k].trim().slice(0, 500);
    }
    copy.stock_quantity = Number(copy.stock_quantity) || 0;
    copy.unit_cost = Number(copy.unit_cost) || 0;
    copy.unit_price = Number(copy.unit_price) || 0;
    return copy;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const v = validateForm(formData);
    if (v) return setError(v);
    setSaving(true);
    try {
      if (initialData && initialData._id) {
        await apiClient.put(`/medicines/${initialData._id}`, sanitize(formData));
      } else {
        await apiClient.post('/medicines', sanitize(formData));
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save medicine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden text-foreground">
        <div className="p-4 border-b flex justify-between items-center bg-emerald-800">
          <h2 className="text-xl font-bold text-white">{isEditing ? 'Edit Medicine' : 'Smart Medicine Entry'}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-sm font-medium text-white hover:text-emerald-100">Close</button>
        </div>
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-800 rounded">{error}</div>}
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Medicine Name *</label>
              <input required placeholder="Enter medicine name" name="medicine_name" value={formData.medicine_name} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Expiry Date *</label>
              <input required type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
                <input placeholder="e.g. acute, chronic, preventive" name="category" value={formData.category} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit Cost</label>
                <input type="number" step="0.01" name="unit_cost" value={formData.unit_cost} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Selling Price (per unit) *</label>
                <input required type="number" step="0.01" min="0" name="unit_price" value={formData.unit_price} onChange={handleChange} placeholder="e.g. 25.00" className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <p className="mt-1 text-xs text-muted-foreground">This is the price shown in Inventory, Cart, Orders and the Invoice.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Purchase Date</label>
                <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Manufacturing Date</label>
                <input type="date" name="manufacturing_date" value={formData.manufacturing_date} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Stock Quantity</label>
                <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Batch Number</label>
                <input name="batch_number" value={formData.batch_number} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-green shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">{saving ? 'Saving...' : initialData && initialData._id ? 'Update medicine' : 'Save Medicine'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}