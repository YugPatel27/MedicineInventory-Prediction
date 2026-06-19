import React, { useState } from 'react';
import { apiClient } from '../api/axios';

export function ReorderModal({ open, onClose, medicine, onSuccess }) {
  const [quantity, setQuantity] = useState(30);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const q = Number(quantity);
    if (!q || q <= 0) return alert('Enter a valid quantity');
    try {
      setLoading(true);
      await apiClient.post('/orders', { medicine_id: medicine.medicine_id, quantity: q });
      onSuccess?.(q);
      onClose();
    } catch (err) {
      console.error('Reorder failed', err);
      alert('Unable to submit reorder request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Reorder {medicine?.medicine_name || medicine?.medicine_id}</h3>
        <p className="text-sm text-muted-foreground mt-2">Create a quick reorder request for this medicine.</p>

        <div className="mt-4">
          <label className="block text-sm text-muted-foreground">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-border px-4 py-2"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-border bg-background px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
            {loading ? 'Sending…' : 'Submit order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReorderModal;
