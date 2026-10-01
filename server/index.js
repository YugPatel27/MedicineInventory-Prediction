import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB, connectDBWithRetry, isDBConnected } from './config/db.js';

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
const PORT = Number(process.env.PORT) || 5002;

// Security & Parsing Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (never touches the database, so it always answers)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    db: isDBConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Make sure the database is reachable before any API route runs.
// On Vercel this (re)connects lazily per container; locally it is a no-op
// once connected. If the DB is down we answer 503 instead of crashing (502).
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database unavailable:', error.message);
    res.status(503).json({
      status: 'error',
      message: 'Database is temporarily unavailable. Please try again in a moment.',
    });
  }
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
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

const isEntryPoint = () => {
  if (process.env.VERCEL) return false;
  if (!process.argv[1]) return false;
  try {
    return realpathSync(path.resolve(process.argv[1])) === realpathSync(__filename);
  } catch {
    return false;
  }
};

if (isEntryPoint()) {
  // Never let a stray error silently kill (or silently wedge) the API.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  const server = http.createServer(app);

  // Report listen failures LOUDLY. Previously a failed listen (port in use /
  // blocked) still printed "Server running" and left the process alive with
  // nothing listening -> every proxied request failed with ECONNREFUSED/502.
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n[FATAL] Port ${PORT} is already in use (another copy of the API is probably still running).`);
      console.error('  Windows : netstat -ano | findstr :' + PORT + '   then   taskkill /PID <pid> /F');
      console.error('  Mac/Linux: lsof -ti :' + PORT + ' | xargs kill -9');
    } else if (error.code === 'EACCES') {
      console.error(`\n[FATAL] No permission to use port ${PORT} (on Windows it may be in a reserved range).`);
      console.error('  Check with: netsh interface ipv4 show excludedportrange protocol=tcp');
    } else {
      console.error('[FATAL] Server error:', error);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Keep retrying MongoDB in the background rather than exiting.
  connectDBWithRetry();

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
