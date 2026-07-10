/**
 * Custom Logistic Regression implementation for predicting shortage risk.
 */
export class LogisticRegression {
  constructor(weights = null, bias = 0.0) {
    // Features:
    // 0: stock_ratio (stock_quantity / minimum_stock)
    // 1: expiry_urgency (1 / (days_until_expiry + 1))
    // 2: reorder_gap_ratio (reorder_gap / minimum_stock)
    // 3: consumption_pressure (avg_monthly_consumption / (stock_quantity + 1))
    this.weights = weights || [-2.5, 3.0, 4.0, 1.5];
    this.bias = bias !== null ? bias : 0.5;
  }

  /**
   * Sigmoid activation function
   */
  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Predict probability of shortage (0.0 to 1.0)
   * @param {Array<number>} features 
   */
  predict(features) {
    let z = this.bias;
    for (let i = 0; i < this.weights.length; i++) {
      z += this.weights[i] * (features[i] || 0);
    }
    return this.sigmoid(z);
  }

  /**
   * Train the model using gradient descent
   * @param {Array<Array<number>>} X - Feature matrix
   * @param {Array<number>} y - Binary labels (1 = shortage risk, 0 = no shortage risk)
   * @param {number} epochs - Number of training steps
   * @param {number} lr - Learning rate
   */
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

/**
 * Pre-trains a Logistic Regression model based on existing medicine dataset
 * @param {Array<any>} medicines 
 * @returns {LogisticRegression}
 */
export function trainShortageModel(medicines) {
  const model = new LogisticRegression();
  
  if (!medicines || medicines.length === 0) {
    return model;
  }

  // Generate synthetic/training data from the current database state
  // to calibrate weights
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

    // Label: 1 if stock is low or out of stock, or expiry is under 30 days
    const isShortageRisk = (stockRatio < 1.0 || daysUntilExpiry <= 30) ? 1 : 0;

    X.push(features);
    y.push(isShortageRisk);
  });

  // Train the model dynamically on this dataset
  model.fit(X, y, 100, 0.1);
  return model;
}
