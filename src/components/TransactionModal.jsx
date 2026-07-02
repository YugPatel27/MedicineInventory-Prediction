import React, { useState } from 'react';
import { apiClient } from '../api/axios';
import Alert from './Alert';

export default function TransactionModal({ medicine, onClose, onSuccess }) {
  const [addedUnits, setAddedUnits] = useState(0);
  const [soldUnits, setSoldUnits] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessResult(null);

    const added = Number(addedUnits) || 0;
    const sold = Number(soldUnits) || 0;

    if (added < 0 || sold < 0) {
      setError('Units must be non-negative values.');
      return;
    }

    if (added === 0 && sold === 0) {
      setError('Please specify added units, sold units, or both.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post(`/medicines/${medicine._id}/transaction`, {
        addedUnits: added,
        soldUnits: sold
      });
      setSuccessResult(data.data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Transaction processing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white w-full max-w-md rounded-[2rem] border border-border shadow-2xl overflow-hidden text-foreground">
        <div className="p-6 border-b border-border bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Record Same-Day Stock Log</h2>
            <p className="text-xs text-muted-foreground mt-1">{medicine.medicine_name} ({medicine.medicine_id})</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm font-semibold">Close</button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4"><Alert type="danger">{error}</Alert></div>}

          {!successResult ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-border bg-slate-50 p-4 mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-semibold text-foreground">{medicine.stock_quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reorder Level:</span>
                  <span className="font-semibold text-foreground">{medicine.reorder_level} units</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Stock Added Today</label>
                <input
                  type="number"
                  min="0"
                  value={addedUnits}
                  onChange={(e) => setAddedUnits(parseInt(e.target.value) || 0)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-1">Units received from suppliers or inventory imports.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Units Sold Today</label>
                <input
                  type="number"
                  min="0"
                  value={soldUnits}
                  onChange={(e) => setSoldUnits(parseInt(e.target.value) || 0)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-1">Units sold or dispensed to patients.</p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-slate-200 bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Post Stock Log'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 space-y-2">
                <p className="font-bold">Transaction completed successfully!</p>
                <div className="text-xs space-y-1 mt-2">
                  <div className="flex justify-between">
                    <span>Initial Stock:</span>
                    <span className="font-semibold">{successResult.initial_stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Added Units:</span>
                    <span className="font-semibold">+{successResult.added_units}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sold Units:</span>
                    <span className="font-semibold">-{successResult.sold_units}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-green-200 pt-1 mt-1 text-sm">
                    <span>Final Stock:</span>
                    <span>{successResult.final_stock}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white text-center"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
