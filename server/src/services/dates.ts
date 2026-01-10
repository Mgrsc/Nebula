function parseISODate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatISODate(year: number, month: number, day: number) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function isValidISODate(iso: string) {
  const p = parseISODate(iso);
  if (!p) return false;
  return p.day <= daysInMonth(p.year, p.month);
}

export function addDaysISO(iso: string, days: number) {
  const p = parseISODate(iso);
  if (!p) return null;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsISO(iso: string, months: number) {
  const p = parseISODate(iso);
  if (!p) return null;
  const totalMonths = (p.year * 12 + (p.month - 1)) + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const month = monthIndex + 1;
  const dim = daysInMonth(year, month);
  const day = Math.min(p.day, dim);
  return formatISODate(year, month, day);
}

export function addYearsISO(iso: string, years: number) {
  return addMonthsISO(iso, years * 12);
}

export type PaymentCycle = "monthly" | "yearly" | "custom_days";

export function computeNextDueDate(args: {
  startDate: string;
  paymentCycle: PaymentCycle;
  customDays?: number | null;
  explicitNextDueDate?: string | null;
}) {
  const { startDate, paymentCycle, customDays, explicitNextDueDate } = args;
  if (!isValidISODate(startDate)) return null;

  if (explicitNextDueDate) {
    if (!isValidISODate(explicitNextDueDate)) return null;
    return explicitNextDueDate;
  }

  if (paymentCycle === "monthly") return addMonthsISO(startDate, 1);
  if (paymentCycle === "yearly") return addYearsISO(startDate, 1);
  if (paymentCycle === "custom_days") {
    const n = Number(customDays);
    if (!Number.isFinite(n) || n <= 0) return null;
    return addDaysISO(startDate, n);
  }
  return null;
}
