import React, { useState } from 'react';
import { apiClient } from '../api/axios';
import Alert from './Alert';

export default function TransactionModal({ medicine, onClose, onSuccess }) {
  const [addedUnits, setAddedUnits] = useState('');
  const [soldUnits, setSoldUnits] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  const medicineId = medicine?._id || medicine?.id || medicine?.medicine_id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessResult(null);

    if (!medicineId) {
      setError('Selected medicine data is invalid.');
      return;
    }

    const added = Number(addedUnits || 0);
    const sold = Number(soldUnits || 0);

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
      const token = localStorage.getItem('mips-access-token');
      if (!token) {
        setError('Not authenticated. Please log in before submitting.');
        setSubmitting(false);
        window.location.href = '/login';
        return;
      }
      const { data } = await apiClient.post(`/medicines/${medicineId}/transaction`, {
        addedUnits: added,
        soldUnits: sold,
      });
      // data.data is the transaction result from server
      setSuccessResult(data.data);
      if (onSuccess && typeof onSuccess === 'function') {
        try { onSuccess(data.data); } catch (e) { console.error('onSuccess handler failed', e); }
      }
    } catch (err) {
      console.error('Transaction error', err);
      // Try to extract meaningful server error message or fallback to full response
      const serverMsg = err?.response?.data?.message || err?.response?.data || err?.message;
      setError(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg));
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
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Stock Added Today</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={addedUnits}
                  onChange={(e) => setAddedUnits(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
                <p className="text-xs text-muted-foreground mt-1">Units received from suppliers or inventory imports.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Units Sold Today</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={soldUnits}
                  onChange={(e) => setSoldUnits(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
                <p className="text-xs text-muted-foreground mt-1">Units sold or dispensed to patients.</p>
              </div>

              <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 w-full sm:w-auto"
                >
                  {submitting ? 'Processing...' : 'Post Stock Log'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 space-y-2">
                <p className="font-bold">Transaction completed successfully!</p>
                <p className="text-xs text-slate-700">This daily stock log was stored and will be used by the prediction engine.</p>
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
