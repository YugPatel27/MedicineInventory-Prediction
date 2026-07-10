import Medicine from '../models/Medicine.js';

/**
 * Manages same-day stock additions and sales/dispensations.
 * Ensures stock levels are updated correctly and consumption metrics capture actual demand.
 * 
 * @param {string} medicineId - The unique medicine_id or database _id of the medicine.
 * @param {number} addedUnits - Number of units received/added to stock.
 * @param {number} soldUnits - Number of units sold/dispensed.
 * @param {object} req - Express request object for audit logs (optional).
 * @returns {object} Transaction result details.
 */
export async function manageStockTransaction({ medicineId, addedUnits = 0, soldUnits = 0 }) {
  // Validate input parameters
  const added = Math.max(0, Number(addedUnits) || 0);
  const sold = Math.max(0, Number(soldUnits) || 0);

  // Find the medicine
  const medicine = await Medicine.findOne({
    $or: [{ _id: medicineId }, { medicine_id: medicineId }]
  });

  if (!medicine) {
    throw new Error(`Medicine with ID ${medicineId} not found.`);
  }

  const initialStock = medicine.stock_quantity || 0;
  const potentialStock = initialStock + added;

  // Validate if we have enough stock to fulfill the sales
  if (potentialStock < sold) {
    throw new Error(
      `Insufficient stock. Initial stock is ${initialStock}, adding ${added} units gives a maximum of ${potentialStock} units. Cannot sell ${sold} units.`
    );
  }

  // Calculate net stock change
  const netChange = added - sold;
  const finalStock = potentialStock - sold;

  // Update stock level
  medicine.stock_quantity = finalStock;
  
  // Track consumption:
  // If we sold units, it represents real demand. We must increase the average monthly consumption.
  // We can add the daily sales directly to the average consumption, or apply a moving average.
  if (sold > 0) {
    // Basic update: Add the sold units directly to average monthly consumption to simulate increased demand.
    medicine.avg_monthly_consumption = (medicine.avg_monthly_consumption || 0) + sold;
  }

  medicine.last_updated = new Date();

  // Save changes (this triggers the pre-save hook that updates the stock status: Low Stock / Out of Stock)
  await medicine.save();

  return {
    id: medicine._id,
    medicine_id: medicine.medicine_id,
    medicine_name: medicine.medicine_name,
    initial_stock: initialStock,
    added_units: added,
    sold_units: sold,
    net_change: netChange,
    final_stock: finalStock,
    status: medicine.status,
    updated_consumption: medicine.avg_monthly_consumption
  };
}
