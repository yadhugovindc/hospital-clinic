import { Token } from '../../database/models/token.model.js';
import { Patient } from '../../database/models/patient.model.js';
import { Visit } from '../../database/models/visit.model.js';
import { PharmacyBill } from '../../database/models/pharmacy-bill.model.js';
import { ProcedureBill } from '../../database/models/procedure-models.js';
import { StockBatch } from '../../database/models/stock-batch.model.js';
import { Purchase } from '../../database/models/purchase.model.js';
import { Expense } from '../../database/models/expense.model.js';
import { ProcedurePlan, ProcedureSession } from '../../database/models/procedure-models.js';
import { User } from '../../database/models/user.model.js';
import { getSettings } from '../clinic-settings/clinic.service.js';
import { clinicToday } from '../../shared/utils/date.js';
import type { Role } from '../../shared/utils/rbac.js';

async function commons(today: string) {
  const [tokens, registrations, visits] = await Promise.all([
    Token.aggregate([{ $match: { tokenDate: today } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Patient.countDocuments({ createdAt: { $gte: new Date(`${today}T00:00:00Z`), $lt: new Date(`${today}T00:00:00Z`) } }),
    0,
  ]);
  void visits;
  const byStatus = Object.fromEntries(tokens.map((t) => [t._id, t.count]));
  return { tokenCounts: byStatus, registrationsToday: registrations };
}

export async function getDashboardForRole(role: Role, userId: string): Promise<Record<string, unknown>> {
  const settings = await getSettings();
  const today = clinicToday(settings.timezone);

  if (role === 'admin') {
    const [{ tokenCounts, registrationsToday }, revenue, lowStock, nearExpiry, activeUsers] = await Promise.all([
      commons(today),
      collectionsForDate(today),
      lowStockCount(),
      nearExpiryCount(30),
      User.countDocuments({ isActive: true }),
    ]);
    return {
      role: 'admin',
      date: today,
      tokenCounts,
      registrationsToday,
      revenue,
      lowStockCount: lowStock,
      nearExpiryCount: nearExpiry,
      activeUsers,
    };
  }

  if (role === 'receptionist') {
    const [{ tokenCounts, registrationsToday }, myQueues] = await Promise.all([commons(today), Promise.resolve(null)]);
    void myQueues;
    return { role, date: today, tokenCounts, registrationsToday };
  }

  if (role === 'doctor') {
    const [queue, completed, followUps] = await Promise.all([
      Token.countDocuments({ tokenDate: today, doctorId: userId, status: 'waiting' }),
      Visit.countDocuments({ visitDate: today, doctorId: userId, status: 'completed' }),
      Visit.find({ doctorId: userId, followUpDate: { $gte: today }, status: 'completed' })
        .sort({ followUpDate: 1 })
        .limit(10)
        .populate('patientId', 'name uhid'),
    ]);
    return { role, date: today, waitingMyQueue: queue, completedToday: completed, followUps };
  }

  if (role === 'pharmacist') {
    const [
      salesToday,
      lowStock,
      nearExpiry,
      recentPurchases,
    ] = await Promise.all([
      PharmacyBill.countDocuments({ billDate: today, status: 'finalized' }),
      lowStockList(10),
      nearExpiryList(30, 10),
      Purchase.find({ status: 'received' }).sort({ createdAt: -1 }).limit(5).populate('supplierId', 'name'),
    ]);
    const salesAgg = await PharmacyBill.aggregate([
      { $match: { billDate: today, status: 'finalized' } },
      { $group: { _id: null, totalMinor: { $sum: '$totalMinor' }, count: { $sum: 1 } } },
    ]);
    return {
      role,
      date: today,
      salesTodayMinor: salesAgg[0]?.totalMinor ?? 0,
      billsToday: salesToday,
      lowStock,
      nearExpiry,
      recentPurchases,
    };
  }

  if (role === 'therapist') {
    const [todaySessions, pending, completed, activePlans] = await Promise.all([
      ProcedureSession.find({ scheduledDate: today }).sort({ sessionIndex: 1 }).populate('patientId', 'name uhid'),
      ProcedureSession.countDocuments({ scheduledDate: today, status: 'scheduled', assignedTherapistId: userId }),
      ProcedureSession.countDocuments({ scheduledDate: today, status: 'completed', assignedTherapistId: userId }),
      ProcedurePlan.countDocuments({ status: 'active' }),
    ]);
    return { role, date: today, todaySessions, pendingMine: pending, completedMine: completed, activePlans };
  }

  // accountant
  const [collections, expensesToday] = await Promise.all([
    collectionsForDate(today),
    Expense.aggregate([
      { $match: { expenseDate: today, reversedBy: { $exists: false } } },
      { $group: { _id: null, totalMinor: { $sum: '$amountMinor' } } },
    ]),
  ]);
  return { role, date: today, collections, expensesTodayMinor: expensesToday[0]?.totalMinor ?? 0 };
}

async function collectionsForDate(date: string): Promise<{ pharmacyMinor: number; procedureMinor: number; expensesMinor: number }> {
  const [pharmacy, procedure, expenses] = await Promise.all([
    PharmacyBill.aggregate([
      { $match: { billDate: date, status: 'finalized' } },
      { $group: { _id: null, total: { $sum: '$totalMinor' } } },
    ]),
    ProcedureBill.aggregate([
      { $match: { billDate: date, status: 'finalized' } },
      { $group: { _id: null, total: { $sum: '$totalMinor' } } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: date, reversedBy: { $exists: false } } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
  ]);
  return {
    pharmacyMinor: pharmacy[0]?.total ?? 0,
    procedureMinor: procedure[0]?.total ?? 0,
    expensesMinor: expenses[0]?.total ?? 0,
  };
}

async function lowStockCount(): Promise<number> {
  const rows = await lowStockList(1000);
  return rows.length;
}

async function nearExpiryCount(days: number): Promise<number> {
  const rows = await nearExpiryList(days, 1000);
  return rows.length;
}

async function lowStockList(limit: number) {
  return lowStockPipeline(limit);
}

async function lowStockPipeline(limit: number) {
  const MedicineModel = (await import('../../database/models/medicine.model.js')).Medicine;
  return MedicineModel.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'stockBatches',
        localField: '_id',
        foreignField: 'medicineId',
        as: 'stockBatches',
        pipeline: [{ $match: { quantityRemaining: { $gt: 0 } } }],
      },
    },
    { $addFields: { stockRemaining: { $sum: '$stockBatches.quantityRemaining' } } },
    { $match: { $expr: { $lt: ['$stockRemaining', '$lowStockThreshold'] } } },
    { $project: { stockBatches: 0 } },
    { $limit: limit },
  ]);
}

async function nearExpiryList(days: number, limit: number) {
  const settings = await getSettings();
  const today = clinicToday(settings.timezone);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + days);
  return StockBatch.aggregate([
    { $match: { quantityRemaining: { $gt: 0 }, expiryDate: { $gt: today, $lte: cutoff.toISOString().slice(0, 10) } } },
    { $sort: { expiryDate: 1 } },
    { $limit: limit },
    { $lookup: { from: 'medicines', localField: 'medicineId', foreignField: '_id', as: 'medicine' } },
    { $unwind: '$medicine' },
    { $project: { 'medicine.stockBatches': 0 } },
  ]);
}
