import mongoose from 'mongoose';

const stockLogSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    medicine_id: { type: String, required: true },
    added_units: { type: Number, default: 0 },
    sold_units: { type: Number, default: 0 },
    net_change: { type: Number, default: 0 },
    stock_before: { type: Number, default: 0 },
    stock_after: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const StockLog = mongoose.model('StockLog', stockLogSchema);
export default StockLog;
