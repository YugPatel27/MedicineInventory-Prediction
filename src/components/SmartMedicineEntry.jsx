import React, { useState } from 'react';
import { apiClient } from '../api/axios';

export function SmartMedicineEntry({ onClose = () => {}, onSuccess = () => {}, initialData = null }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    medicine_id: `MED-${Math.floor(Math.random() * 10000)}`,
    medicine_name: '',
    generic_name: '',
    category: '',
    dosage: '',
    manufacturer: '',
    batch_number: `BAT-${Math.floor(Math.random() * 10000)}`,
    stock_quantity: 0,
    expiry_date: '',
    unit_cost: 0,
    dosage_form: '',
    strength: '',
    storage_requirements: 'Room Temperature',
  });

  // If `initialData` is provided (edit mode), populate the form so data is visible
  React.useEffect(() => {
    if (initialData) {
      setFormData((p) => ({ ...p, ...initialData }));
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
    return null;
  };

  const sanitize = (f) => {
    const copy = { ...f };
    for (const k of Object.keys(copy)) {
      if (typeof copy[k] === 'string') copy[k] = copy[k].trim().slice(0, 500);
    }
    copy.stock_quantity = Number(copy.stock_quantity) || 0;
    copy.unit_cost = Number(copy.unit_cost) || 0;
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
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden text-foreground">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold">Smart Medicine Entry</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground">Close</button>
        </div>
        <div className="p-4">
          {error && <div className="mb-4 p-3 bg-sky-50 text-sky-800 rounded">{error}</div>}
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="block text-sm font-medium">Medicine Name *</label>
              <input required placeholder="Enter medicine name" name="medicine_name" value={formData.medicine_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium">Expiry Date *</label>
              <input required type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white text-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Stock Quantity</label>
                <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium">Unit Cost</label>
                <input type="number" step="0.01" name="unit_cost" value={formData.unit_cost} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white text-foreground" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded bg-slate-100 text-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded">{saving ? 'Saving...' : initialData && initialData._id ? 'Update medicine' : 'Save Medicine'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}