import mongoose from 'mongoose';

const { Schema } = mongoose;

const MedicineSchema = new Schema(
  {
    medicine_id: { type: String, required: true, unique: true },
    medicine_name: { type: String, required: true },
    category: { type: String, required: true },
    batch_number: { type: String, required: true },
    supplier_email: { type: String, required: true },
    stock_quantity: { type: Number, required: true },
    minimum_stock: { type: Number, required: true },
    reorder_level: { type: Number, required: true },
    safety_stock: { type: Number, required: true },
    lead_time_days: { type: Number, required: true },
    expiry_date: { type: Date, required: true },
    unit_cost: { type: Number, required: true },
    status: { type: String, default: 'In Stock' },
    shortage_risk_score: { type: Number, default: 0 },
    predicted_demand: { type: Number, default: 0 },
    avg_monthly_consumption: { type: Number, default: 0 },
    last_updated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MedicineSchema.pre('save', function (next) {
  if (this.stock_quantity <= 0) {
    this.status = 'Out of Stock';
  } else if (this.stock_quantity <= this.minimum_stock) {
    this.status = 'Low Stock';
  } else {
    this.status = 'In Stock';
  }
  next();
});

export default mongoose.model('Medicine', MedicineSchema);
