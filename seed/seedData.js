import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_medicine_db';

export const seedDatabase = async () => {
  const shouldDisconnect = mongoose.connection.readyState !== 1;
  if (shouldDisconnect) {
    await mongoose.connect(mongoURI);
  }

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log('Database already seeded. Skipping seed.');
    if (shouldDisconnect) await mongoose.disconnect();
    return;
  }

  await Medicine.deleteMany({});
  await User.deleteMany({});

  const admin = new User({
    name: 'Admin User',
    email: 'admin@hospital.com',
    password: 'admin123',
    role: 'Admin',
    permissions: ['ALL'],
  });
  await admin.save();

  const staff = new User({
    name: 'Staff User',
    email: 'user@hospital.com',
    password: 'user123',
    role: 'User',
    permissions: [],
  });
  await staff.save();

  const medicines = [
    {
      medicine_id: 'MED001',
      medicine_name: 'Amoxicillin 500mg',
      category: 'Antibiotics',
      batch_number: 'B12345',
      supplier_email: 'supply@globalmeds.com',
      stock_quantity: 500,
      minimum_stock: 100,
      reorder_level: 150,
      safety_stock: 50,
      lead_time_days: 5,
      expiry_date: new Date('2026-12-31'),
      unit_cost: 12.5,
    },
    {
      medicine_id: 'MED002',
      medicine_name: 'Paracetamol 650mg',
      category: 'Analgesics',
      batch_number: 'B67890',
      supplier_email: 'supply@globalmeds.com',
      stock_quantity: 1000,
      minimum_stock: 200,
      reorder_level: 300,
      safety_stock: 100,
      lead_time_days: 3,
      expiry_date: new Date('2027-06-30'),
      unit_cost: 5.25,
    },
    {
      medicine_id: 'MED003',
      medicine_name: 'Metformin 850mg',
      category: 'Antidiabetics',
      batch_number: 'B11223',
      supplier_email: 'supply@globalmeds.com',
      stock_quantity: 40,
      minimum_stock: 50,
      reorder_level: 75,
      safety_stock: 25,
      lead_time_days: 7,
      expiry_date: new Date('2025-10-15'),
      unit_cost: 18.75,
    },
  ];

  await Medicine.insertMany(medicines);
  console.log('Seeding completed successfully');

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.includes('seedData.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
