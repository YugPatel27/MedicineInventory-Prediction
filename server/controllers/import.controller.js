import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import Medicine from '../models/Medicine.js';

const UPLOAD_DIR = path.resolve('uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.json'];

// Columns that MUST be present (after header normalization) for a file to
// be considered a valid medicine stock sheet. If any of these are missing
// the upload is rejected as "wrong format" and the original file is kept
// in the uploads folder for the user to inspect, instead of being deleted.
const REQUIRED_HEADER_FIELDS = ['medicine_id', 'medicine_name', 'batch_number', 'expiry_date'];

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
    batch_number: 'batch_number',
    batchno: 'batch_number',
    batch: 'batch_number',
    category: 'category',
    medicine_category: 'category',
    drug_category: 'category',
    purchase_date: 'purchase_date',
    purchasedate: 'purchase_date',
    purchase: 'purchase_date',
    manufacturing_date: 'manufacturing_date',
    manufacture_date: 'manufacturing_date',
    mfg_date: 'manufacturing_date',
    mfgdate: 'manufacturing_date',
    manufacturingdate: 'manufacturing_date',
    stock_quantity: 'stock_quantity',
    stock: 'stock_quantity',
    quantity: 'stock_quantity',
    minimum_stock: 'minimum_stock',
    minimumstock: 'minimum_stock',
    min_stock: 'minimum_stock',
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
    // Selling/retail price columns. Without these mappings, a column like
    // "Unit_Price_INR" (used in medicines_correct.csv) normalizes to
    // 'unit_price_inr' — which matches nothing below — so the price is
    // silently dropped and every imported medicine gets unit_price: 0.
    // That 0 then flows untouched through Inventory, Cart, Orders and the
    // Invoice, which is why price looked "missing" everywhere downstream.
    unit_price: 'unit_price',
    unitprice: 'unit_price',
    price: 'unit_price',
    unit_price_inr: 'unit_price',
    unitpriceinr: 'unit_price',
    selling_price: 'unit_price',
    sellingprice: 'unit_price',
    sale_price: 'unit_price',
    saleprice: 'unit_price',
    mrp: 'unit_price',
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

const loadRawDataFromFile = (filePath, extension) => {
  if (extension === '.json') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const rawData = Array.isArray(parsed) ? parsed : parsed.records || [];
    if (!Array.isArray(rawData)) {
      throw new Error('JSON must contain an array of records');
    }
    return rawData;
  }

  const workbook = xlsx.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Spreadsheet is empty');
  }
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
};

const parseDateValue = (value) => {
  if (!value && value !== 0) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Filter the file on its header row before any parsing happens. This is the
 * "correct header and parsing format" gate: a file must expose every
 * required column (after normalization/alias mapping) or it is rejected
 * outright, without inserting anything into the database.
 */
const validateHeaderFormat = (rawData) => {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return { valid: false, missing: REQUIRED_HEADER_FIELDS, reason: 'The file has no data rows to read.' };
  }

  const firstRow = rawData[0];
  const headerKeys = Array.isArray(firstRow) ? [] : Object.keys(firstRow || {});
  if (headerKeys.length === 0) {
    return { valid: false, missing: REQUIRED_HEADER_FIELDS, reason: 'No column headers were detected in the file.' };
  }

  const mappedFields = new Set(headerKeys.map(mapFieldName));
  const missing = REQUIRED_HEADER_FIELDS.filter((field) => !mappedFields.has(field));

  return {
    valid: missing.length === 0,
    missing,
    reason: missing.length
      ? `Missing required column(s): ${missing.join(', ')}.`
      : '',
  };
};

const prepareMedicinesFromRawData = (rawData) => {
  const requiredFields = ['medicine_id', 'medicine_name', 'batch_number'];
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
        batch_number: String(values.batch_number ?? ''),
        category: String(values.category ?? '').trim(),
        purchase_date: parseDateValue(values.purchase_date ?? values.purchasedate ?? values.purchase),
        manufacturing_date: parseDateValue(values.manufacturing_date ?? values.manufacture_date ?? values.mfg_date ?? values.mfgdate ?? values.manufacturingdate),
        stock_quantity: Number(values.stock_quantity ?? values.stock ?? values.quantity ?? 0),
        minimum_stock: Number(values.minimum_stock ?? values.min_stock ?? values.minimumstock ?? 0),
        safety_stock: Number(values.safety_stock ?? values.safetystock ?? 0),
        lead_time_days: Number(values.lead_time_days ?? values.leadtimedays ?? 0),
        expiry_date: expiry,
        unit_cost: Number(values.unit_cost ?? values.unitcost ?? values.cost ?? 0),
        // Was missing entirely — the parsed medicine object never carried a
        // unit_price field, so every import fell back to the schema default
        // of 0 regardless of what the source file actually contained.
        unit_price: Number(values.unit_price ?? values.price ?? values.mrp ?? 0),
      };
    })
    .filter((item) => item !== null);

  return {
    medicines,
    errors,
    totalRows: rawData.length,
  };
};

/**
 * Writes the parsed, normalized records to a JSON file inside the uploads
 * folder (next to where the source file lived) so there is a durable JSON
 * copy of every successfully imported batch.
 */
const writeJsonSnapshot = (sourceFilePath, extension, payload) => {
  const jsonFileName = `${path.basename(sourceFilePath, extension)}.json`;
  const jsonFilePath = path.join(UPLOAD_DIR, jsonFileName);
  fs.writeFileSync(jsonFilePath, JSON.stringify(payload, null, 2), 'utf8');
  return jsonFileName;
};

/**
 * Full pipeline used by both the direct upload endpoint and the
 * process-stored-file endpoint:
 *  1. Load raw rows from the file on disk.
 *  2. Validate the header/column format — throws INVALID_FORMAT if the
 *     required columns are not present.
 *  3. Parse rows into medicine records and insert the valid ones.
 *  4. Persist a JSON snapshot of the parsed data in the uploads folder.
 * The caller decides whether to delete the source file based on whether
 * this function threw an INVALID_FORMAT error.
 */
const processStoredFile = async (filePath, extension) => {
  const rawData = loadRawDataFromFile(filePath, extension);

  const headerCheck = validateHeaderFormat(rawData);
  if (!headerCheck.valid) {
    const err = new Error(headerCheck.reason || 'File format not recognized.');
    err.code = 'INVALID_FORMAT';
    err.missingColumns = headerCheck.missing;
    throw err;
  }

  const { medicines, errors, totalRows } = prepareMedicinesFromRawData(rawData);

  let inserted = 0;
  if (medicines.length > 0) {
    const result = await Medicine.insertMany(medicines, { ordered: false });
    inserted = result.length;
  }

  const jsonFile = writeJsonSnapshot(filePath, extension, {
    source_file: path.basename(filePath),
    imported_at: new Date().toISOString(),
    total_rows: totalRows,
    inserted,
    record_count: medicines.length,
    records: medicines,
  });

  return {
    total_rows: totalRows,
    inserted,
    failed: totalRows - inserted,
    errors,
    json_file: jsonFile,
  };
};

export const bulkInsert = async (req, res) => {
  let keepFile = false;

  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'Upload file is required' });
    }

    const extension = path.extname(req.file.originalname || '').toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      keepFile = true;
      return res.status(400).json({
        status: 'error',
        message: `"${req.file.originalname}" is not a supported file type. Upload a .csv, .xlsx, .xls, or .json file. The file has been kept in the uploads folder.`,
        invalidFormat: true,
      });
    }

    const result = await processStoredFile(req.file.path, extension);

    res.status(200).json({
      status: 'success',
      message: `Imported successfully. Data was converted to JSON (${result.json_file}) and the source file was removed.`,
      data: result,
    });
  } catch (error) {
    if (error?.code === 'INVALID_FORMAT') {
      keepFile = true;
      return res.status(400).json({
        status: 'error',
        message: `File format not recognized. ${error.message} The file has been kept in the uploads folder for review — nothing was imported.`,
        invalidFormat: true,
        missingColumns: error.missingColumns || [],
      });
    }

    // Unexpected error — keep the file so it can be investigated instead
    // of silently discarding it.
    keepFile = true;
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message, invalidFormat: true });
  } finally {
    if (!keepFile && req?.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup errors
      }
    }
  }
};

export const storeUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'Upload file is required' });
  }

  const storedFile = {
    filename: path.basename(req.file.path),
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    uploadedAt: new Date().toISOString(),
  };

  res.status(200).json({ status: 'success', message: 'File stored successfully', data: storedFile });
};

export const getLatestUpload = async (req, res) => {
  try {
    const uploads = fs.readdirSync(UPLOAD_DIR)
      .filter((file) => ['.csv', '.xlsx', '.xls'].includes(path.extname(file).toLowerCase()))
      .map((file) => {
        const stats = fs.statSync(path.join(UPLOAD_DIR, file));
        const originalName = file.replace(/^[0-9]+-[0-9]+-/, '');
        return {
          filename: file,
          originalName,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const latest = uploads[0] || null;
    res.status(200).json({ status: 'success', data: { latest } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const processStoredUpload = async (req, res) => {
  let keepFile = true; // stored files are only ever deleted on a successful parse below

  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ status: 'error', message: 'Filename is required' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'error', message: 'Stored file not found' });
    }

    const extension = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return res.status(400).json({
        status: 'error',
        message: 'Unsupported stored file type. The file has been kept in the uploads folder.',
        invalidFormat: true,
      });
    }

    const result = await processStoredFile(filePath, extension);
    keepFile = false; // valid format & parsed successfully — safe to remove the source file
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup errors
    }

    res.status(200).json({
      status: 'success',
      message: `Stored upload processed successfully. Data was converted to JSON (${result.json_file}) and the source file was removed.`,
      data: result,
    });
  } catch (error) {
    if (error?.code === 'INVALID_FORMAT') {
      return res.status(400).json({
        status: 'error',
        message: `File format not recognized. ${error.message} The file remains in the uploads folder for review — nothing was imported.`,
        invalidFormat: true,
        missingColumns: error.missingColumns || [],
      });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message, invalidFormat: true });
  }
};

export const deleteStoredUpload = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) return res.status(400).json({ status: 'error', message: 'Filename is required' });

    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'error', message: 'Stored file not found' });
    }

    fs.unlinkSync(filePath);
    return res.status(200).json({ status: 'success', message: 'Stored upload removed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};
