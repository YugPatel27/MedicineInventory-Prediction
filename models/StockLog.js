import mongoose from 'mongoose';

const { Schema } = mongoose;

const StockLogSchema = new Schema(
  {
    medicine: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicine_id: { type: String, required: true },
    added_units: { type: Number, default: 0 },
    sold_units: { type: Number, default: 0 },
    net_change: { type: Number, required: true },
    stock_before: { type: Number, required: true },
    stock_after: { type: Number, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('StockLog', StockLogSchema);
