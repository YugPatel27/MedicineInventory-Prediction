import Medicine from '../models/Medicine.js';
import StockLog from '../models/StockLog.js';
import { recordAudit } from '../utils/audit.js';
import { manageStockTransaction } from '../utils/stockManager.js';

const buildAlerts = (medicines) => {
  const today = new Date();

  const expiringSoon = medicines
    .filter((medicine) => {
      const expiry = new Date(medicine.expiry_date);
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 90;
    })
    .map((medicine) => ({
      medicine_id: medicine.medicine_id,
      medicine_name: medicine.medicine_name,
      expiry_date: medicine.expiry_date,
      days_left: Math.ceil((new Date(medicine.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    }));

  const lowStock = medicines
    .filter((medicine) => medicine.stock_quantity <= medicine.minimum_stock)
    .map((medicine) => ({
      medicine_id: medicine.medicine_id,
      medicine_name: medicine.medicine_name,
      stock_quantity: medicine.stock_quantity,
      minimum_stock: medicine.minimum_stock,
      status: medicine.status,
    }));

  return { expiringSoon, lowStock };
};

export const getAllMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find();
    res.status(200).json({ status: 'success', data: medicines });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const getSummary = async (req, res) => {
  try {
    const medicines = await Medicine.find();
    const alerts = buildAlerts(medicines);

    const reorderGapItems = medicines.filter((medicine) => {
      const gap = (medicine.minimum_stock || 0) - (medicine.stock_quantity || 0);
      return gap > 0;
    });

    const summary = {
      totalMedicines: medicines.length,
      lowStock: alerts.lowStock.length,
      outOfStock: medicines.filter((medicine) => medicine.status === 'Out of Stock').length,
      expiringSoon: alerts.expiringSoon.length,
      highRisk: medicines.filter((medicine) => (medicine.shortage_risk_score || 0) >= 75).length,
      reorderGapCount: reorderGapItems.length,
      reorderGapTotal: reorderGapItems.reduce((sum, medicine) => sum + Math.max(0, (medicine.minimum_stock || 0) - (medicine.stock_quantity || 0)), 0),
    };

    res.status(200).json({ status: 'success', data: { summary, alerts } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const medicines = await Medicine.find();
    const alerts = buildAlerts(medicines);
    res.status(200).json({ status: 'success', data: alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ status: 'error', message: 'Medicine not found' });
    res.status(200).json({ status: 'success', data: medicine });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const createMedicine = async (req, res) => {
  try {
    const medicine = new Medicine(req.body);
    await medicine.save();
    try { await recordAudit({ req, action: 'create_medicine', target: medicine.medicine_id, details: medicine.toObject() }); } catch (e) { console.warn('audit failed', e); }
    res.status(201).json({ status: 'success', data: medicine });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bad request';
    res.status(400).json({ status: 'error', message });
  }
};

export const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!medicine) return res.status(404).json({ status: 'error', message: 'Medicine not found' });
    try { await recordAudit({ req, action: 'update_medicine', target: medicine.medicine_id, details: req.body }); } catch (e) { console.warn('audit failed', e); }
    res.status(200).json({ status: 'success', data: medicine });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bad request';
    res.status(400).json({ status: 'error', message });
  }
};

export const deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) return res.status(404).json({ status: 'error', message: 'Medicine not found' });
    try { await recordAudit({ req, action: 'delete_medicine', target: medicine.medicine_id, details: medicine.toObject() }); } catch (e) { console.warn('audit failed', e); }
    res.status(200).json({ status: 'success', message: 'Medicine deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const processStockTransaction = async (req, res) => {
  try {
    const { addedUnits, soldUnits } = req.body;
    const medicineId = req.params.id;

    const result = await manageStockTransaction({
      medicineId,
      addedUnits,
      soldUnits
    });

    await StockLog.create({
      medicine: result.id,
      medicine_id: result.medicine_id,
      added_units: result.added_units,
      sold_units: result.sold_units,
      net_change: result.net_change,
      stock_before: result.initial_stock,
      stock_after: result.final_stock,
    });

    try {
      await recordAudit({
        req,
        action: 'stock_transaction',
        target: result.medicine_id,
        details: {
          added_units: addedUnits,
          sold_units: soldUnits,
          initial_stock: result.initial_stock,
          final_stock: result.final_stock,
          net_change: result.net_change
        }
      });
    } catch (e) {
      console.warn('audit failed', e);
    }

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bad Request';
    res.status(400).json({ status: 'error', message });
  }
};
