import { supportedCurrencyCodes } from "../data/currencies";

export function formatMoney(amount: number, currency: string, options?: { maximumFractionDigits?: number }) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2
    }).format(amount);
  } catch {
    const decimals = options?.maximumFractionDigits ?? 2;
    return `${amount.toFixed(decimals)} ${currency}`;
  }
}

export function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidCurrency(code: string): boolean {
  return supportedCurrencyCodes.has(code);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function insertTextAtCursor(
  ref: React.RefObject<HTMLTextAreaElement>,
  text: string,
  currentVal: string,
  setter: (v: string) => void
) {
  const el = ref.current;
  if (!el) {
    setter(currentVal + text);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const nextVal = currentVal.substring(0, start) + text + currentVal.substring(end);
  setter(nextVal);

  setTimeout(() => {
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  }, 0);
}
