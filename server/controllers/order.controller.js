import mongoose from 'mongoose';
import Order, { ORDER_STATUS_VALUES } from '../models/Order.js';
import Medicine from '../models/Medicine.js';
import StockLog from '../models/StockLog.js';
import { manageStockTransaction } from '../utils/stockManager.js';
import { recordAudit } from '../utils/audit.js';
import { hasInventoryAccess } from '../utils/inventoryAccess.js';

const DEFAULT_TAX_RATE = 0.05; // 5% GST, matches the billing summary shown to customers

function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `ORD-${Date.now()}-${rand}`;
}

/**
 * Builds the Mongo filter used to look an order up by whatever the caller
 * passed in the URL — either its Mongo _id or its human-facing orderNumber
 * (e.g. "ORD-1787489736671-m87eb6uz").
 *
 * Bug this fixes: Mongoose casts every field in a query against the schema
 * before running it, including inside `$or`. `orderNumber` values are never
 * valid 24-char ObjectId hex strings, so `{ $or: [{ _id: id }, ...] }` made
 * Mongoose throw a CastError for every single lookup by order number — the
 * `orderNumber` branch never even got a chance to match. That CastError
 * landed in the route's catch block as an unhandled 500 ("Unable to load
 * order"), which is exactly the failure seen when opening an order, viewing
 * its invoice, or saving an update. Only including `_id` in the query when
 * the id actually looks like an ObjectId avoids the cast entirely.
 */
function orderLookupQuery(id) {
  return /^[a-f0-9]{24}$/i.test(id) ? { $or: [{ _id: id }, { orderNumber: id }] } : { orderNumber: id };
}

/**
 * Create a billing order from the customer's cart. Stock is decremented
 * per line item using the same stock-transaction utility the Daily Log
 * modal uses, so inventory, StockLog and Order all stay consistent.
 */
export const createOrder = async (req, res) => {
  try {
    if (!hasInventoryAccess(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Inventory access has not been granted by an administrator' });
    }
    const { items, customer, paymentMethod, taxRate } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Cart is empty — add at least one medicine.' });
    }
    if (!customer?.name) {
      return res.status(400).json({ status: 'error', message: 'Customer / recipient name is required.' });
    }

    // Resolve authoritative price + stock straight from the database — never trust client-sent prices.
    const resolvedItems = [];
    for (const raw of items) {
      const lookupId = raw.medicineId || raw._id || raw.medicine_id;
      if (!lookupId || !raw.quantity || raw.quantity <= 0) {
        return res.status(400).json({ status: 'error', message: 'Each cart line needs a valid medicine and quantity.' });
      }
      const medicine = hasInventoryAccess(req.user)
        ? await Medicine.findOne({ $or: [{ _id: lookupId }, { medicine_id: lookupId }] })
        : null;
      if (!medicine) {
        return res.status(404).json({ status: 'error', message: `Medicine "${raw.medicine_name || lookupId}" was not found.` });
      }
      if (medicine.stock_quantity < raw.quantity) {
        return res.status(409).json({
          status: 'error',
          message: `Only ${medicine.stock_quantity} unit(s) of ${medicine.medicine_name} are in stock (requested ${raw.quantity}).`,
        });
      }
      const unit_price = medicine.unit_price || 0;
      resolvedItems.push({
        medicine: medicine._id,
        medicine_id: medicine.medicine_id,
        medicine_name: medicine.medicine_name,
        batch_number: medicine.batch_number,
        quantity: raw.quantity,
        unit_price,
        line_total: Number((unit_price * raw.quantity).toFixed(2)),
      });
    }

    const subtotal = Number(resolvedItems.reduce((sum, i) => sum + i.line_total, 0).toFixed(2));
    const effectiveTaxRate = typeof taxRate === 'number' && taxRate >= 0 ? taxRate : DEFAULT_TAX_RATE;
    const taxAmount = Number((subtotal * effectiveTaxRate).toFixed(2));
    const grandTotal = Number((subtotal + taxAmount).toFixed(2));

    // Apply the stock deduction for every line item before persisting the order.
    const stockResults = [];
    for (const item of resolvedItems) {
      const result = await manageStockTransaction({ medicineId: item.medicine, soldUnits: item.quantity });
      stockResults.push(result);
      await StockLog.create({
        medicine: result.id,
        medicine_id: result.medicine_id,
        added_units: 0,
        sold_units: item.quantity,
        net_change: result.net_change,
        stock_before: result.initial_stock,
        stock_after: result.final_stock,
      });
    }

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      items: resolvedItems,
      subtotal,
      taxRate: effectiveTaxRate,
      taxAmount,
      grandTotal,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        whatsapp: customer.whatsapp || customer.phone,
        address: customer.address,
        city: customer.city,
        pincode: customer.pincode,
        notes: customer.notes,
      },
      paymentMethod: paymentMethod || 'COD',
      status: 'Placed',
      statusHistory: [{ status: 'Placed', changedAt: new Date(), changedBy: req.user._id, changedByName: req.user.name }],
      placedBy: req.user._id,
      placedByName: req.user.name,
    });

    try {
      await recordAudit({
        req,
        action: 'create_order',
        target: order.orderNumber,
        details: { items: resolvedItems.map((i) => ({ medicine_id: i.medicine_id, quantity: i.quantity })), grandTotal },
      });
    } catch (e) {
      console.warn('audit failed', e);
    }

    try { global.__lastOrderEvent = { orderNumber: order.orderNumber, at: Date.now() }; } catch (e) {}

    res.status(201).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Create order failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to create order';
    res.status(400).json({ status: 'error', message });
  }
};

/**
 * Admins/Managers see every order; everyone else only sees orders they placed.
 * Supports pagination (page/limit) and sort order (latest|oldest), always
 * querying/sorting by createdAt so "latest" reliably means most recently placed.
 */
export const listOrders = async (req, res) => {
  try {
    const isPrivileged = ['Admin', 'Manager'].includes(req.user.role);
    const query = isPrivileged ? {} : { placedBy: req.user._id };

    const { status, search, sort } = req.query;
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const sortDirection = sort === 'oldest' ? 1 : -1; // default: latest order placed first

    const total = await Order.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const orders = await Order.find(query)
      .sort({ createdAt: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit);

    // Status counts across the FULL filtered set (not just this page), so
    // the summary tiles on the Orders screen stay accurate under pagination.
    const [placed, processing, delivered] = await Promise.all([
      Order.countDocuments({ ...query, status: 'Placed' }),
      Order.countDocuments({ ...query, status: { $in: ['Confirmed', 'Processing', 'Shipped'] } }),
      Order.countDocuments({ ...query, status: 'Delivered' }),
    ]);

    res.status(200).json({
      status: 'success',
      data: orders,
      pagination: { page, limit, total, totalPages },
      summary: { total, placed, processing, delivered },
    });
  } catch (error) {
    console.error('List orders failed:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load orders' });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne(orderLookupQuery(req.params.id));
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    const isPrivileged = ['Admin', 'Manager'].includes(req.user.role);
    if (!isPrivileged && String(order.placedBy) !== String(req.user._id)) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to this order' });
    }

    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Get order failed:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load order' });
  }
};

/** Admin-only: move an order through its fulfilment lifecycle. */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!ORDER_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ status: 'error', message: `Status must be one of: ${ORDER_STATUS_VALUES.join(', ')}` });
    }

    const order = await Order.findOne(orderLookupQuery(req.params.id));
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    order.status = status;
    order.statusHistory.push({ status, changedAt: new Date(), changedBy: req.user._id, changedByName: req.user.name, note });
    if (status === 'Delivered') order.paymentStatus = order.paymentMethod === 'COD' ? 'Paid' : order.paymentStatus;
    await order.save();

    try {
      await recordAudit({ req, action: 'update_order_status', target: order.orderNumber, details: { status, note } });
    } catch (e) {
      console.warn('audit failed', e);
    }

    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Update order status failed:', error);
    res.status(400).json({ status: 'error', message: 'Unable to update order status' });
  }
};

/**
 * Admin-only: edit an order's delivery/customer/payment details after it was
 * placed (e.g. fix an address typo or switch payment method). Line items and
 * stock are intentionally left untouched here — status changes still go
 * through updateOrderStatus, which is the only place stock/paymentStatus
 * side effects happen.
 */
export const updateOrder = async (req, res) => {
  try {
    const order = await Order.findOne(orderLookupQuery(req.params.id));
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    const { customer, paymentMethod } = req.body;
    if (customer && typeof customer === 'object') {
      const allowed = ['name', 'email', 'phone', 'whatsapp', 'address', 'city', 'pincode', 'notes'];
      for (const key of allowed) {
        if (customer[key] !== undefined) order.customer[key] = customer[key];
      }
    }
    if (paymentMethod) order.paymentMethod = paymentMethod;

    await order.save();

    try {
      await recordAudit({ req, action: 'update_order_details', target: order.orderNumber, details: { customer, paymentMethod } });
    } catch (e) {
      console.warn('audit failed', e);
    }

    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Update order failed:', error);
    res.status(400).json({ status: 'error', message: 'Unable to update order' });
  }
};

export const orderStatusOptions = (req, res) => {
  res.status(200).json({ status: 'success', data: ORDER_STATUS_VALUES });
};
