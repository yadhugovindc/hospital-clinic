import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../shared/logging/logger.js';

mongoose.set('strictQuery', true);

/** Connects to MongoDB using the configured URI. */
export async function connectDatabase(): Promise<typeof mongoose> {
  return mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

mongoose.connection.on('connected', () => {
  logger.info(`MongoDB connected (${mongoose.connection.name})`);
});
mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB connection error');
});
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});
