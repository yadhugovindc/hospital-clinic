export type Role = 'admin' | 'receptionist' | 'doctor' | 'pharmacist' | 'therapist' | 'accountant';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface Patient {
  _id: string;
  uhid: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  ageYears?: number;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  registrationNotes?: string;
  createdAt: string;
}

export type TokenStatus = 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';

export interface Token {
  _id: string;
  tokenDate: string;
  tokenNumber: number;
  patientId: Pick<Patient, '_id' | 'name' | 'uhid' | 'phone' | 'gender'> & { ageYears?: number | null; dateOfBirth?: string | null };
  departmentId?: { _id: string; name: string };
  doctorId?: { _id: string; name: string };
  status: TokenStatus;
  note?: string;
  createdAt: string;
}

export interface Visit {
  _id: string;
  patientId: string;
  tokenId?: string;
  doctorId: string | { _id: string; name: string };
  visitDate: string;
  status: 'open' | 'completed' | 'cancelled';
  chiefComplaints?: string;
  clinicalNotes?: string;
  vitals?: Record<string, number>;
  examinationFindings?: string;
  diagnosis?: string;
  investigations?: string;
  followUpDate?: string;
  followUpNotes?: string;
  createdBy: string;
}

export interface PrescriptionItem {
  medicineId: string | { _id: string; name: string; form?: string; strength?: string };
  nameSnapshot: string;
  form?: string;
  strength?: string;
  dosage?: string;
  frequency: string;
  timing?: string;
  durationDays?: number;
  instructions?: string;
}

export interface Prescription {
  _id: string;
  visitId: string;
  patientId: string;
  doctorId: string | { _id: string; name: string };
  prescriptionDate: string;
  status: 'draft' | 'finalized' | 'cancelled';
  items: PrescriptionItem[];
  generalInstructions?: string;
}

export interface Medicine {
  _id: string;
  name: string;
  category?: string;
  form: string;
  strength?: string;
  unit: string;
  isAyurvedic: boolean;
  taxRatePercent: number;
  sellingPriceMinor: number;
  lowStockThreshold: number;
  isActive: boolean;
  stockRemaining?: number;
}

export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  isActive: boolean;
}

export interface PurchaseLine {
  medicineId: string | { _id: string; name: string };
  medicineNameSnapshot?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePriceMinor: number;
  taxRatePercent: number;
  taxAmountMinor: number;
  lineTotalMinor: number;
}

export interface Purchase {
  _id: string;
  purchaseNumber: string;
  supplierId: string | { _id: string; name: string };
  supplierNameSnapshot?: string;
  invoiceNumber?: string;
  purchaseDate: string;
  status: 'received' | 'cancelled';
  lines: PurchaseLine[];
  subtotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
}

export interface StockBatch {
  _id: string;
  medicineId: { _id: string; name: string; form?: string; unit?: string } | string;
  batchNumber: string;
  expiryDate: string;
  quantityReceived: number;
  quantityRemaining: number;
  purchasePriceMinor: number;
  sellingPriceMinor: number;
}

export interface StockMovement {
  _id: string;
  medicineId: { _id: string; name: string } | string;
  batchNumberSnapshot: string;
  type: string;
  quantityChange: number;
  reason?: string;
  createdAt: string;
}

export interface PharmacyBillLine {
  medicineId: string;
  medicineNameSnapshot: string;
  batchNumberSnapshot: string;
  expiryDateSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  discountPercent: number;
  taxRatePercent: number;
  discountMinor: number;
  taxAmountMinor: number;
  lineTotalMinor: number;
}

export interface PharmacyBill {
  _id: string;
  billNumber: string;
  patientId: string | { _id: string; name: string; uhid: string };
  patientNameSnapshot: string;
  uhidSnapshot: string;
  billDate: string;
  status: 'finalized' | 'cancelled';
  paymentMethod: string;
  lines: PharmacyBillLine[];
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
}

export interface ProcedureCatalogItem {
  _id: string;
  name: string;
  description?: string;
  defaultSessionDurationMinutes: number;
  priceMinor: number;
  taxRatePercent: number;
  isActive: boolean;
}

export interface ProcedurePlanItem {
  procedureId: string | { _id: string };
  nameSnapshot: string;
  sessionsPlanned: number;
  sessionsCompleted: number;
  unitPriceMinor: number;
  taxRatePercent: number;
}

export interface ProcedurePlan {
  _id: string;
  planNumber: string;
  patientId: string | { _id: string; name: string; uhid: string };
  uhidSnapshot?: string;
  planDate: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'cancelled';
  items: ProcedurePlanItem[];
}

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'missed' | 'rescheduled';

export interface ProcedureSession {
  _id: string;
  planId: string;
  procedureId: string;
  procedureNameSnapshot: string;
  patientId: { _id: string; name: string; uhid: string } | string;
  scheduledDate: string;
  sessionIndex: number;
  status: SessionStatus;
  assignedTherapistId?: { _id: string; name: string } | string;
  notes?: string;
}

export interface ProcedureBill {
  _id: string;
  billNumber: string;
  patientId: string | { _id: string; name: string; uhid: string };
  patientNameSnapshot?: string;
  uhidSnapshot?: string;
  billDate: string;
  status: 'finalized' | 'cancelled';
  paymentMethod: string;
  lines: Array<{
    nameSnapshot: string;
    sessionsCount: number;
    unitPriceMinor: number;
    discountPercent: number;
    discountMinor: number;
    taxRatePercent: number;
    taxAmountMinor: number;
    lineTotalMinor: number;
  }>;
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
}

export interface Expense {
  _id: string;
  expenseNumber: string;
  category: string;
  description: string;
  amountMinor: number;
  expenseDate: string;
  paymentMethod: string;
  reference?: string;
  reversalReason?: string;
  reversedBy?: string | null;
}

export interface DayBook {
  date: string;
  entries: Array<{ kind: string; number: string; description: string; method: string; amountMinor: number; createdAt: string }>;
  totals: { billsMinor: number; expensesMinor: number; netMinor: number; byMethod: Record<string, number> };
}

export interface FinancialReport {
  startDate: string;
  endDate: string;
  collections: Array<{ kind: string; amountMinor: number; count: number }>;
  netCollectionsMinor: number;
  expenses: Array<{ category: string; amountMinor: number; count: number }>;
  netExpensesMinor: number;
  netIncomeMinor: number;
  daily: Array<{ date: string; collectionsMinor: number; expensesMinor: number }>;
}

export interface ClinicSettings {
  _id: string;
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoText?: string;
  currency: string;
  timezone: string;
  gstinNumber?: string;
  defaultTaxRatePercent: number;
  consultationFeeMinor: number;
  invoicePrefixes: Record<string, { prefix: string; nextNumber: number }>;
}

export interface AuditLogEntry {
  _id: string;
  actorId?: { name?: string; email?: string; role?: string } | null;
  action: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
}

export interface ServerUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}

export type DashboardData = Record<string, unknown> & { role: Role; date: string };
