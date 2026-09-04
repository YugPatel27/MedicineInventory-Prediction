import Medicine from '../models/Medicine.js';

export async function manageStockTransaction({ medicineId, addedUnits = 0, soldUnits = 0 }) {
  const added = Math.max(0, Number(addedUnits) || 0);
  const sold = Math.max(0, Number(soldUnits) || 0);

  const medicine = await Medicine.findOne({
    $or: [{ _id: medicineId }, { medicine_id: medicineId }]
  });

  if (!medicine) {
    throw new Error(`Medicine with ID ${medicineId} not found.`);
  }

  const initialStock = medicine.stock_quantity || 0;
  const potentialStock = initialStock + added;

  if (potentialStock < sold) {
    throw new Error(
      `Insufficient stock. Initial stock is ${initialStock}, adding ${added} units gives a maximum of ${potentialStock} units. Cannot sell ${sold} units.`
    );
  }

  const netChange = added - sold;
  const finalStock = potentialStock - sold;

  medicine.stock_quantity = finalStock;
  
  if (sold > 0) {
    medicine.avg_monthly_consumption = (medicine.avg_monthly_consumption || 0) + sold;
  }

  medicine.last_updated = new Date();
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
