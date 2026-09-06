import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import Medicine from '../models/Medicine.js';
import StockLog from '../models/StockLog.js';
import { recordAudit } from '../utils/audit.js';
import { manageStockTransaction } from '../utils/stockManager.js';
import { inventoryVisibilityFilter } from '../utils/inventoryAccess.js';

const REFERENCE_PRICE_FILE = path.resolve('server/data/medicines_reference.csv');

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
    const medicines = await Medicine.find(inventoryVisibilityFilter(req.user));
    res.status(200).json({ status: 'success', data: medicines });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const getSummary = async (req, res) => {
  try {
    const medicines = await Medicine.find(inventoryVisibilityFilter(req.user));
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
    const medicines = await Medicine.find(inventoryVisibilityFilter(req.user));
    const alerts = buildAlerts(medicines);
    res.status(200).json({ status: 'success', data: alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, ...inventoryVisibilityFilter(req.user) });
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

/**
 * Fixes already-existing Medicine documents that have unit_price: 0 (the
 * consequence of the import-mapping bug — see import.controller.js) by
 * matching each record's medicine_id against the bundled reference sheet
 * (server/data/medicines_reference.csv, the known-correct price list) and
 * writing the correct unit_price straight into MongoDB. This is separate
 * from the import-controller fix, which only prevents the bug for *future*
 * imports — this endpoint repairs data that is already sitting in the
 * database from before the fix.
 *
 * By default only records with a missing/zero price are touched; pass
 * { force: true } in the body to re-sync every matched record's price.
 */
export const backfillPricesFromReference = async (req, res) => {
  try {
    if (!fs.existsSync(REFERENCE_PRICE_FILE)) {
      return res.status(404).json({ status: 'error', message: 'Reference price sheet not found on the server.' });
    }

    const force = Boolean(req.body?.force);

    const workbook = xlsx.readFile(REFERENCE_PRICE_FILE, { raw: false });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    const priceById = new Map();
    for (const row of rows) {
      const id = String(row.Medicine_ID ?? row.medicine_id ?? '').trim().toUpperCase();
      const price = Number(row.Unit_Price_INR ?? row.unit_price ?? row.Unit_Price ?? 0);
      if (id && Number.isFinite(price) && price > 0) {
        priceById.set(id, price);
      }
    }

    if (priceById.size === 0) {
      return res.status(400).json({ status: 'error', message: 'No usable price data found in the reference sheet.' });
    }

    const query = force ? {} : { $or: [{ unit_price: { $exists: false } }, { unit_price: { $lte: 0 } }] };
    const candidates = await Medicine.find(query).select('_id medicine_id unit_price');

    let updated = 0;
    const updates = [];
    for (const medicine of candidates) {
      const key = String(medicine.medicine_id || '').trim().toUpperCase();
      const referencePrice = priceById.get(key);
      if (referencePrice === undefined) continue;
      updates.push({
        updateOne: {
          filter: { _id: medicine._id },
          update: { $set: { unit_price: referencePrice, last_updated: new Date() } },
        },
      });
    }

    if (updates.length > 0) {
      const result = await Medicine.bulkWrite(updates);
      updated = result.modifiedCount ?? updates.length;
    }

    try {
      await recordAudit({
        req,
        action: 'backfill_prices',
        target: 'medicines',
        details: { scanned: candidates.length, updated, force },
      });
    } catch (e) {
      console.warn('audit failed', e);
    }

    res.status(200).json({
      status: 'success',
      message: updated > 0
        ? `Updated selling price directly in the database for ${updated} medicine(s).`
        : 'No medicines needed a price update.',
      data: { scanned: candidates.length, updated, referenceEntries: priceById.size },
    });
  } catch (error) {
    console.error('Backfill prices failed:', error);
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
