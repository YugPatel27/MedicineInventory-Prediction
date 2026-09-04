import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import medicineRoutes from './routes/medicine.routes.js';
import adminRoutes from './routes/admin.routes.js';
import importRoutes from './routes/import.routes.js';
import orderRoutes from './routes/order.routes.js';
import predictionRoutes from './routes/prediction.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;

// Connect to MongoDB
connectDB();

// Security & Parsing Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/import', importRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/predictions', predictionRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
