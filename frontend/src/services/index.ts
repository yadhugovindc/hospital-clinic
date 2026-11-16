import { api, qs } from '../lib/api';
import type {
  AuditLogEntry, ClinicSettings, DayBook, Expense, FinancialReport, Medicine, Patient, PharmacyBill,
  Prescription, ProcedureBill, ProcedureCatalogItem, ProcedurePlan, ProcedureSession, Purchase,
  ServerUser, SessionUser, StockBatch, StockMovement, Supplier, Token, Visit,
} from '../types';

// ---------- Auth ----------
export const authApi = {
  login: async (email: string, password: string): Promise<SessionUser> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data.user;
  },
  me: async (): Promise<SessionUser | null> => {
    try {
      const res = await api.get('/auth/me');
      return res.data.user;
    } catch {
      return null;
    }
  },
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },
};

// ---------- Users ----------
export const usersApi = {
  list: (params?: { page?: number; limit?: number; role?: string; search?: string }): Promise<{ users: ServerUser[]; total: number }> =>
    api.get('/users' + qs({ page: 1, limit: 100, ...params })).then((r) => r.data),
  create: (payload: { email: string; name: string; password: string; role: string }): Promise<ServerUser> =>
    api.post('/users', payload).then((r) => r.data.user),
  update: (id: string, payload: { name?: string; role?: string; password?: string }): Promise<ServerUser> =>
    api.patch(`/users/${id}`, payload).then((r) => r.data.user),
  setStatus: (id: string, isActive: boolean): Promise<ServerUser> =>
    api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data.user),
  doctors: (): Promise<{ doctors: ServerUser[] }> => api.get('/users/doctors').then((r) => r.data),
  therapists: (): Promise<{ therapists: ServerUser[] }> => api.get('/users/therapists').then((r) => r.data),
};

// ---------- Clinic ----------
export const clinicApi = {
  get: (): Promise<ClinicSettings> => api.get('/clinic').then((r) => r.data.settings),
  update: (payload: Partial<ClinicSettings>): Promise<ClinicSettings> => api.patch('/clinic', payload).then((r) => r.data.settings),
};

// ---------- Reception ----------
export const receptionApi = {
  register: (payload: Record<string, unknown>): Promise<Patient> => api.post('/reception/patients', payload).then((r) => r.data.patient),
  searchPatients: (params: { page?: number; limit?: number; uhid?: string; name?: string; phone?: string; sort?: string }): Promise<{ patients: Patient[]; total: number; page: number; limit: number }> =>
    api.get('/reception/patients' + qs(params)).then((r) => r.data),
  patient: (id: string): Promise<Patient> => api.get(`/reception/patients/${id}`).then((r) => r.data.patient),
  updatePatient: (id: string, payload: Record<string, unknown>): Promise<Patient> => api.patch(`/reception/patients/${id}`, payload).then((r) => r.data.patient),
  checkDuplicates: (payload: { phone?: string; name?: string; gender?: string }): Promise<Array<{ id: string; uhid: string; name: string; phone: string }>> =>
    api.post('/reception/patients/duplicates', payload).then((r) => r.data.duplicates),
  bookToken: (payload: { patientId: string; doctorId?: string; note?: string; tokenDate?: string }): Promise<Token> =>
    api.post('/reception/tokens', payload).then((r) => r.data.token),
  tokens: (params: { tokenDate?: string; status?: string; doctorId?: string; patientId?: string; page?: number; limit?: number }): Promise<{ tokens: Token[]; total: number }> =>
    api.get('/reception/tokens' + qs(params)).then((r) => r.data),
  tokenCounts: (tokenDate?: string): Promise<Record<string, number | string>> =>
    api.get('/reception/tokens/counts' + qs({ tokenDate })).then((r) => r.data),
  setTokenStatus: (id: string, status: string): Promise<Token> => api.patch(`/reception/tokens/${id}/status`, { status }).then((r) => r.data.token),
};

// ---------- Clinical ----------
export const clinicalApi = {
  createVisit: (payload: Record<string, unknown>): Promise<Visit> => api.post('/doctor/visits', payload).then((r) => r.data.visit),
  visits: (params: { page?: number; limit?: number; patientId?: string; visitDate?: string; status?: string }): Promise<{ visits: Visit[]; total: number }> =>
    api.get('/doctor/visits' + qs(params)).then((r) => r.data),
  visit: (id: string): Promise<Visit> => api.get(`/doctor/visits/${id}`).then((r) => r.data.visit),
  updateVisit: (id: string, payload: Record<string, unknown>): Promise<Visit> => api.patch(`/doctor/visits/${id}`, payload).then((r) => r.data.visit),
  history: (patientId: string): Promise<Visit[]> => api.get(`/doctor/patients/${patientId}/history`).then((r) => r.data.history),
  createPrescription: (payload: { visitId: string; items: unknown[]; generalInstructions?: string; status?: string }): Promise<Prescription> =>
    api.post(`/doctor/visits/${payload.visitId}/prescriptions`, payload).then((r) => r.data.prescription),
  prescription: (id: string): Promise<Prescription> => api.get(`/doctor/prescriptions/${id}`).then((r) => r.data.prescription),
  updatePrescription: (id: string, payload: Record<string, unknown>): Promise<Prescription> =>
    api.patch(`/doctor/prescriptions/${id}`, payload).then((r) => r.data.prescription),
  patientPrescriptions: (patientId: string): Promise<Prescription[]> =>
    api.get(`/doctor/patients/${patientId}/prescriptions`).then((r) => r.data.prescriptions),
  icdCodes: (): Promise<Array<{ code: string; description: string }>> => api.get('/doctor/icd-codes').then((r) => r.data.codes),
};

// ---------- Pharmacy ----------
export const pharmacyApi = {
  medicines: (params: { page?: number; limit?: number; search?: string; lowStock?: boolean }): Promise<{ medicines: Medicine[]; total: number }> =>
    api.get('/pharmacy/medicines' + qs({ ...params, lowStock: params.lowStock ? 'true' : undefined })).then((r) => r.data),
  createMedicine: (payload: Record<string, unknown>): Promise<Medicine> => api.post('/pharmacy/medicines', payload).then((r) => r.data.medicine),
  updateMedicine: (id: string, payload: Record<string, unknown>): Promise<Medicine> => api.patch(`/pharmacy/medicines/${id}`, payload).then((r) => r.data.medicine),
  medicineStock: (id: string): Promise<{ remaining: number }> => api.get(`/pharmacy/medicines/${id}/stock`).then((r) => r.data),
  suppliers: (): Promise<{ suppliers: Supplier[] }> => api.get('/pharmacy/suppliers').then((r) => r.data),
  createSupplier: (payload: Record<string, unknown>): Promise<Supplier> => api.post('/pharmacy/suppliers', payload).then((r) => r.data.supplier),
  purchases: (params: { page?: number; limit?: number }): Promise<{ purchases: Purchase[]; total: number }> =>
    api.get('/pharmacy/purchases' + qs(params)).then((r) => r.data),
  createPurchase: (payload: Record<string, unknown>): Promise<Purchase> => api.post('/pharmacy/purchases', payload).then((r) => r.data.purchase),
  stock: (params: { page?: number; limit?: number; medicineId?: string }): Promise<{ batches: StockBatch[]; total: number }> =>
    api.get('/pharmacy/stock' + qs(params)).then((r) => r.data),
  expiry: (params: { withinDays?: number; expired?: boolean; page?: number; limit?: number }): Promise<{ batches: StockBatch[]; total: number }> =>
    api.get('/pharmacy/stock/expiry' + qs({ ...params, expired: params.expired ? 'true' : 'false' })).then((r) => r.data),
  adjustStock: (payload: { batchId: string; quantityChange: number; reason: string }): Promise<DailyResult> => api.post('/pharmacy/stock/adjust', payload).then((r) => r.data),
  movements: (params: { page?: number; limit?: number }): Promise<{ movements: StockMovement[]; total: number }> =>
    api.get('/pharmacy/stock/movements' + qs(params)).then((r) => r.data),
  createBill: (payload: { patientId: string; paymentMethod?: string; lines: Array<{ medicineId: string; quantity: number; discountPercent?: number }> }): Promise<PharmacyBill> =>
    api.post('/pharmacy/bills', payload).then((r) => r.data.bill),
  bills: (params: { page?: number; limit?: number; patientId?: string; billDate?: string }): Promise<{ bills: PharmacyBill[]; total: number }> =>
    api.get('/pharmacy/bills' + qs(params)).then((r) => r.data),
  bill: (id: string): Promise<PharmacyBill> => api.get(`/pharmacy/bills/${id}`).then((r) => r.data.bill),
  cancelBill: (id: string, reason: string): Promise<PharmacyBill> => api.post(`/pharmacy/bills/${id}/cancel`, { reason }).then((r) => r.data.bill),
};

// ---------- Procedures ----------
export const proceduresApi = {
  catalog: (includeInactive = false): Promise<ProcedureCatalogItem[]> => api.get('/procedures/catalog' + qs({ includeInactive })).then((r) => r.data.procedures),
  createCatalogItem: (payload: Record<string, unknown>): Promise<ProcedureCatalogItem> => api.post('/procedures/catalog', payload).then((r) => r.data.procedure),
  updateCatalogItem: (id: string, payload: Record<string, unknown>): Promise<ProcedureCatalogItem> => api.patch(`/procedures/catalog/${id}`, payload).then((r) => r.data.procedure),
  createPlan: (payload: { patientId: string; startDate: string; endDate?: string; items: Array<{ procedureId: string; sessionsPlanned: number }>; assignedTherapistId?: string; notes?: string }): Promise<ProcedurePlan> =>
    api.post('/procedures/plans', payload).then((r) => r.data.plan),
  plans: (params: { page?: number; limit?: number; patientId?: string; status?: string; therapistId?: string }): Promise<{ plans: ProcedurePlan[]; total: number }> =>
    api.get('/procedures/plans' + qs(params)).then((r) => r.data),
  plan: (id: string): Promise<{ plan: ProcedurePlan; sessions: ProcedureSession[] }> => api.get(`/procedures/plans/${id}`).then((r) => r.data),
  sessions: (params: { scheduledDate?: string; therapistId?: string; status?: string; page?: number; limit?: number }): Promise<{ sessions: ProcedureSession[]; total: number }> =>
    api.get('/procedures/sessions' + qs(params)).then((r) => r.data),
  updateSession: (id: string, payload: { status?: string; scheduledDate?: string; notes?: string }): Promise<ProcedureSession> =>
    api.patch(`/procedures/sessions/${id}`, payload).then((r) => r.data.session),
  createBill: (payload: { patientId: string; paymentMethod?: string; lines: Array<{ planId: string; procedureId: string; sessionsCount: number; discountPercent?: number }> }): Promise<ProcedureBill> =>
    api.post('/procedures/bills', payload).then((r) => r.data.bill),
  bills: (params: { page?: number; limit?: number; patientId?: string }): Promise<{ bills: ProcedureBill[]; total: number }> =>
    api.get('/procedures/bills' + qs(params)).then((r) => r.data),
  cancelBill: (id: string, reason: string): Promise<ProcedureBill> => api.post(`/procedures/bills/${id}/cancel`, { reason }).then((r) => r.data.bill),
};

// ---------- Accounts ----------
export const accountsApi = {
  expenses: (params: { page?: number; limit?: number; expenseDate?: string; category?: string }): Promise<{ expenses: Expense[]; total: number }> =>
    api.get('/accounts/expenses' + qs(params)).then((r) => r.data),
  createExpense: (payload: Record<string, unknown>): Promise<Expense> => api.post('/accounts/expenses', payload).then((r) => r.data.expense),
  reverseExpense: (id: string, reason: string): Promise<Expense> => api.post(`/accounts/expenses/${id}/reverse`, { reason }).then((r) => r.data.expense),
  daybook: (date?: string): Promise<DayBook> => api.get('/accounts/daybook' + qs({ date })).then((r) => r.data),
  report: (startDate: string, endDate: string): Promise<FinancialReport> => api.get('/accounts/reports' + qs({ startDate, endDate })).then((r) => r.data),
  reportCsvUrl: (startDate: string, endDate: string): string => `${api.defaults.baseURL}/accounts/reports/csv${qs({ startDate, endDate })}`,
};

// ---------- Dashboard, audit ----------
export const miscApi = {
  dashboard: (): Promise<Record<string, unknown> & { role: string; date: string }> => api.get('/dashboard').then((r) => r.data),
  auditLogs: (params: { page?: number; limit?: number; entityType?: string }): Promise<{ logs: AuditLogEntry[]; total: number }> =>
    api.get('/audit' + qs(params)).then((r) => r.data),
};

interface DailyResult {
  batch: { _id: string; quantityRemaining: number };
}
