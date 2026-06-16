import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import Medicine from '../models/Medicine.js';

const normalizeHeader = (header) => {
  if (!header) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

const mapFieldName = (header) => {
  const normalized = normalizeHeader(header);
  const mapping = {
    id: 'medicine_id',
    medicineid: 'medicine_id',
    medicine_id: 'medicine_id',
    drugcode: 'medicine_id',
    sku: 'medicine_id',
    name: 'medicine_name',
    medicinename: 'medicine_name',
    drug_name: 'medicine_name',
    category: 'category',
    type: 'category',
    batch_number: 'batch_number',
    batchno: 'batch_number',
    batch: 'batch_number',
    supplier_email: 'supplier_email',
    supplieremail: 'supplier_email',
    email: 'supplier_email',
    stock_quantity: 'stock_quantity',
    stock: 'stock_quantity',
    quantity: 'stock_quantity',
    minimum_stock: 'minimum_stock',
    minimumstock: 'minimum_stock',
    min_stock: 'minimum_stock',
    reorder_level: 'reorder_level',
    reorderlevel: 'reorder_level',
    safety_stock: 'safety_stock',
    safetystock: 'safety_stock',
    lead_time_days: 'lead_time_days',
    leadtimedays: 'lead_time_days',
    expiry_date: 'expiry_date',
    expirydate: 'expiry_date',
    expiry: 'expiry_date',
    expiration_date: 'expiry_date',
    expirationdate: 'expiry_date',
    unit_cost: 'unit_cost',
    unitcost: 'unit_cost',
    cost: 'unit_cost',
  };
  return mapping[normalized] || normalized;
};

const extractRowValues = (row, headers) => {
  const values = {};
  if (Array.isArray(row)) {
    headers.forEach((header, index) => {
      values[mapFieldName(header)] = row[index];
    });
  } else if (row && typeof row === 'object') {
    Object.entries(row).forEach(([key, value]) => {
      values[mapFieldName(key)] = value;
    });
  }
  return values;
};

export const bulkInsert = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'Upload file is required' });
    }

    const extension = path.extname(req.file.originalname || '').toLowerCase();
    let rawData = [];

    if (extension === '.json') {
      const raw = fs.readFileSync(req.file.path, 'utf8');
      const parsed = JSON.parse(raw);
      rawData = Array.isArray(parsed) ? parsed : parsed.records || [];
      if (!Array.isArray(rawData)) {
        return res.status(400).json({ status: 'error', message: 'JSON must contain an array of records' });
      }
    } else {
      const workbook = xlsx.readFile(req.file.path, { cellDates: true, raw: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ status: 'error', message: 'Spreadsheet is empty' });
      }
      rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    }

    const requiredFields = ['medicine_id', 'medicine_name', 'category', 'batch_number', 'supplier_email'];
    const errors = [];
    const medicines = rawData
      .map((row, index) => {
        const values = extractRowValues(row, Object.keys(row));
        const expiryRaw = values.expiry_date ?? values.expirydate ?? values.expiry ?? values.expiration_date ?? values.expirationdate ?? '';
        const expiry = new Date(String(expiryRaw));

        for (const field of requiredFields) {
          const value = values[field];
          if (value === undefined || value === null || String(value).trim() === '') {
            errors.push({ row: index + 2, message: `${field} is required` });
            return null;
          }
        }

        if (Number.isNaN(expiry.getTime())) {
          errors.push({ row: index + 2, message: 'Invalid expiry date' });
          return null;
        }

        return {
          medicine_id: String(values.medicine_id ?? ''),
          medicine_name: String(values.medicine_name ?? ''),
          category: String(values.category ?? ''),
          batch_number: String(values.batch_number ?? ''),
          supplier_email: String(values.supplier_email ?? ''),
          stock_quantity: Number(values.stock_quantity ?? values.stock ?? values.quantity ?? 0),
          minimum_stock: Number(values.minimum_stock ?? values.min_stock ?? values.minimumstock ?? 0),
          reorder_level: Number(values.reorder_level ?? values.reorderlevel ?? 0),
          safety_stock: Number(values.safety_stock ?? values.safetystock ?? 0),
          lead_time_days: Number(values.lead_time_days ?? values.leadtimedays ?? 0),
          expiry_date: expiry,
          unit_cost: Number(values.unit_cost ?? values.unitcost ?? values.cost ?? 0),
        };
      })
      .filter((item) => item !== null);

    let inserted = 0;
    if (medicines.length > 0) {
      const result = await Medicine.insertMany(medicines, { ordered: false });
      inserted = result.length;
    }

    res.status(200).json({
      status: 'success',
      message: 'Imported successfully',
      data: {
        total_rows: rawData.length,
        inserted,
        failed: rawData.length - inserted,
        errors,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  } finally {
    if (req?.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup errors
      }
    }
  }
};
