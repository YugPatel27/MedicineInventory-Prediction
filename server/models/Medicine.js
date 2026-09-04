import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    medicine_id: { type: String, required: true, unique: true, trim: true },
    medicine_name: { type: String, required: true, trim: true },
    category: { type: String, default: 'general' },
    batch_number: { type: String, trim: true },
    stock_quantity: { type: Number, default: 0, min: 0 },
    minimum_stock: { type: Number, default: 0, min: 0 },
    safety_stock: { type: Number, default: 0, min: 0 },
    lead_time_days: { type: Number, default: 0 },
    expiry_date: { type: Date, required: true },
    unit_cost: { type: Number, default: 0, min: 0 },
    unit_price: { type: Number, default: 0, min: 0 },
    avg_monthly_consumption: { type: Number, default: 0 },
    shortage_risk_score: { type: Number, default: 0 },
    status: { type: String, enum: ['Normal', 'Low Stock', 'Out of Stock', 'Expired'], default: 'Normal' },
    last_updated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

medicineSchema.pre('save', function () {
  const today = new Date();
  if (this.expiry_date && new Date(this.expiry_date) < today) {
    this.status = 'Expired';
  } else if (this.stock_quantity <= 0) {
    this.status = 'Out of Stock';
  } else if (this.stock_quantity <= this.minimum_stock) {
    this.status = 'Low Stock';
  } else {
    this.status = 'Normal';
  }
});

const Medicine = mongoose.model('Medicine', medicineSchema);
export default Medicine;
