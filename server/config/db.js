import mongoose from 'mongoose';

const DEFAULT_URI = 'mongodb://localhost:27017/smart_medicine_db';

let connectPromise = null;

/**
 * Connects to MongoDB once and reuses the connection (important on Vercel,
 * where the function can be invoked many times per container).
 * Throws on failure instead of killing the process, so callers can decide
 * how to respond (retry locally, return 503 on serverless).
 */
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  const mongoURI = process.env.MONGO_URI || DEFAULT_URI;

  connectPromise = mongoose
    .connect(mongoURI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    })
    .then((m) => {
      console.log('MongoDB Connected successfully');
      return m.connection;
    })
    .catch((error) => {
      connectPromise = null; // allow a later retry
      throw error;
    });

  return connectPromise;
};

/**
 * Local/dev helper: keep retrying in the background until MongoDB is up,
 * instead of exiting and leaving the frontend with a dead API.
 */
export const connectDBWithRetry = async (delayMs = 3000) => {
  for (;;) {
    try {
      await connectDB();
      return;
    } catch (error) {
      console.error(`MongoDB connection failed (${error.message}). Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

export const isDBConnected = () => mongoose.connection.readyState === 1;
