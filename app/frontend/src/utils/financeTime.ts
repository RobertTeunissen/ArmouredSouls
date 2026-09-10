export interface FinanceTimeFormatOptions {
  locale?: string;
  timeZone?: string;
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

/** Formats an absolute server ISO instant in the browser locale and timezone. */
export function formatFinanceInstant(
  isoInstant: string,
  options: FinanceTimeFormatOptions = {},
): string {
  const instant = new Date(isoInstant);
  if (Number.isNaN(instant.getTime())) return 'Time unavailable';

  return new Intl.DateTimeFormat(options.locale, {
    ...DATE_TIME_OPTIONS,
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(instant);
}

export function formatFinancePeriod(
  startsAt: string,
  endsAt: string,
  options: FinanceTimeFormatOptions = {},
): string {
  return `${formatFinanceInstant(startsAt, options)} – ${formatFinanceInstant(endsAt, options)}`;
}
