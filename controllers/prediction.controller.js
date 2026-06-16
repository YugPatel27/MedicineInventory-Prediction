import Medicine from '../models/Medicine.js';
import { recordAudit } from '../utils/audit.js';

export const runForecasting = async (req, res) => {
  try {
    try { await recordAudit({ req, action: 'run_forecast', target: 'predictions', details: {} }); } catch (e) { console.warn('audit failed', e); }
    const medicines = await Medicine.find();

    const predictions = medicines.map((med) => {
      const stockQuantity = med.stock_quantity || 0;
      const minimumStock = med.minimum_stock || 1;
      const stockRatio = stockQuantity / minimumStock;
      const expiryDate = med.expiry_date ? new Date(med.expiry_date) : null;
      const today = new Date();
      const daysUntilExpiry = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 999;
      const reorderGap = Math.max(0, minimumStock - stockQuantity);
      const baseDemand = med.avg_monthly_consumption || Math.max(minimumStock, Math.ceil(minimumStock * 1.2));
      const predictedDemand = Math.max(Math.ceil(baseDemand), reorderGap, 1);

      let riskScore = 0;
      if (stockRatio < 0.5) {
        riskScore = 90 + Math.random() * 10;
      } else if (stockRatio < 1) {
        riskScore = 60 + Math.random() * 30;
      } else if (stockRatio < 2) {
        riskScore = 30 + Math.random() * 30;
      } else {
        riskScore = Math.random() * 30;
      }

      if (daysUntilExpiry <= 30) {
        riskScore += 12;
      }
      if (stockQuantity <= 0) {
        riskScore = Math.max(riskScore, 98);
      }

      const riskScoreRounded = Math.min(100, Math.floor(riskScore));
      let recommendation = 'SUSTAIN_STOCK';
      if (riskScoreRounded > 75) recommendation = 'URGENT_REORDER';
      else if (riskScoreRounded > 50) recommendation = 'PLAN_REORDER';

      return {
        medicine_id: med.medicine_id,
        name: med.medicine_name,
        stock_quantity: stockQuantity,
        minimum_stock: minimumStock,
        reorder_gap: reorderGap,
        predicted_demand: predictedDemand,
        risk_score: riskScoreRounded,
        recommendation,
        expiry_date: med.expiry_date,
        days_until_expiry: daysUntilExpiry,
      };
    });

    await Promise.all(
      predictions.map((p) =>
        Medicine.findOneAndUpdate(
          { medicine_id: p.medicine_id },
          {
            shortage_risk_score: p.risk_score,
            predicted_demand: p.predicted_demand,
          }
        )
      )
    );

    res.status(200).json({ status: 'success', data: predictions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};
