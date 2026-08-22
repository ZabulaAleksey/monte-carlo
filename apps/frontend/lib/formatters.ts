export function formatMoney(
  value: string | number,
  locale: string,
  currency = "USD",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency}`;
  }
}

export function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale);
}

export function formatPercent(value: string | number, digits = 2): string {
  return `${Number(value).toFixed(digits)}%`;
}
