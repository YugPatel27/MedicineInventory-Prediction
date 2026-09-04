import mongoose from 'mongoose';

const ORDER_STATUSES = ['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    medicine_id: { type: String, required: true },
    medicine_name: { type: String, required: true },
    batch_number: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String },
    note: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },

    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0.05 },
    taxAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      pincode: { type: String, trim: true },
      notes: { type: String, trim: true },
    },

    paymentMethod: { type: String, enum: ['COD', 'UPI', 'Card', 'Insurance'], default: 'COD' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },

    status: { type: String, enum: ORDER_STATUSES, default: 'Placed' },
    statusHistory: { type: [statusHistorySchema], default: [] },

    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    placedByName: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ placedBy: 1, createdAt: -1 });

export const ORDER_STATUS_VALUES = ORDER_STATUSES;

const Order = mongoose.model('Order', orderSchema);
export default Order;
