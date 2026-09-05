export type Booking = {
  id: string;
  createdAt: number;
  clientName: string;
  whatsapp: string;
  email: string | null;
  service: string;
  serviceLabel: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  balanceCents: number;
  paymentOption: 'deposit' | 'full';
  paymentAmountCents: number;
  balancePaidCents: number;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentPreferenceId: string | null;
  paymentId: string | null;
  paymentUrl: string | null;
  paymentReceiptUrl: string | null;
  paidAt: number | null;
  balancePaidAt: number | null;
  expiresAt: number | null;
  consentAt: number | null;
  notes: string | null;
  receiptKey: string | null;
  receiptName: string | null;
};

export type ScheduleBlock = {
  id: string;
  blockDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  createdAt: number;
};

export type Expense = {
  id: string;
  expenseDate: string;
  description: string;
  category: string;
  amountCents: number;
  createdAt: number;
};
