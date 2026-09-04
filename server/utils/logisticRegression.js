export class LogisticRegression {
  constructor(weights = null, bias = 0.0) {
    this.weights = weights || [-2.5, 3.0, 4.0, 1.5];
    this.bias = bias !== null ? bias : 0.5;
  }

  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  predict(features) {
    let z = this.bias;
    for (let i = 0; i < this.weights.length; i++) {
      z += this.weights[i] * (features[i] || 0);
    }
    return this.sigmoid(z);
  }

  fit(X, y, epochs = 200, lr = 0.05) {
    if (X.length === 0 || y.length === 0) return;
    
    const numFeatures = X[0].length;
    this.weights = new Array(numFeatures).fill(0.0);
    this.bias = 0.0;

    const m = X.length;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const dW = new Array(numFeatures).fill(0.0);
      let dB = 0.0;

      for (let i = 0; i < m; i++) {
        const xi = X[i];
        const yi = y[i];
        const pred = this.predict(xi);
        const error = pred - yi;

        for (let j = 0; j < numFeatures; j++) {
          dW[j] += error * xi[j];
        }
        dB += error;
      }

      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= (lr * dW[j]) / m;
      }
      this.bias -= (lr * dB) / m;
    }
  }
}

export function trainShortageModel(medicines) {
  const model = new LogisticRegression();
  
  if (!medicines || medicines.length === 0) {
    return model;
  }

  const X = [];
  const y = [];
  const today = new Date();

  medicines.forEach((med) => {
    const stockQuantity = med.stock_quantity || 0;
    const minimumStock = med.minimum_stock || 1;
    const stockRatio = stockQuantity / minimumStock;
    
    const expiryDate = med.expiry_date ? new Date(med.expiry_date) : null;
    const daysUntilExpiry = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 999;
    const expiryUrgency = 1 / (daysUntilExpiry + 1);

    const reorderGap = Math.max(0, minimumStock - stockQuantity);
    const reorderGapRatio = reorderGap / minimumStock;

    const baseDemand = med.avg_monthly_consumption || 0;
    const consumptionPressure = baseDemand / (stockQuantity + 1);

    const features = [stockRatio, expiryUrgency, reorderGapRatio, consumptionPressure];
    const isShortageRisk = (stockRatio < 1.0 || daysUntilExpiry <= 30) ? 1 : 0;

    X.push(features);
    y.push(isShortageRisk);
  });

  model.fit(X, y, 100, 0.1);
  return model;
}
