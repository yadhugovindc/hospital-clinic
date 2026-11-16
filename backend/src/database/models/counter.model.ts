import mongoose, { model, Model, Schema } from 'mongoose';

export interface CounterDoc {
  _id: string; // key like "uhid" or "token:2026-10-18"
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, min: 0 },
  },
  { collection: 'counters' },
);

const Counter = model<CounterDoc, Model<CounterDoc>>('Counter', counterSchema);
export default Counter;

/**
 * Atomically increments a named counter. Uses a single findOneAndUpdate with
 * $inc + upsert, which is concurrency-safe even under parallel requests.
 * Never derive counters by counting existing documents.
 */
export async function nextNumber(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (!doc) throw new Error(`Counter ${key} not available`);
  return doc.seq;
}

/** Peeks (read-modify preview) without incrementing — used for display only. */
export async function peekNumber(key: string): Promise<number> {
  const doc = await Counter.findById(key);
  return doc ? doc.seq : 0;
}
