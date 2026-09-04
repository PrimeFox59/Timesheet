/**
 * Metso Commissioning Management System
 * Centralized Timezone & Date Helper: Enforces GMT+07:00 (WIB - Waktu Indonesia Barat / Asia/Jakarta)
 */

export const TIMEZONE_WIB = 'Asia/Jakarta';

/**
 * Returns current timestamp formatted as 'YYYY-MM-DD HH:mm:ss' in GMT+07:00 (WIB)
 */
export function getWibTimestamp(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}:${map.second}`;
}

/**
 * Returns current date string as 'YYYY-MM-DD' in GMT+07:00 (WIB)
 */
export function getWibDateStr(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Returns current month string as 'YYYY-MM' in GMT+07:00 (WIB)
 */
export function getWibMonthStr(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_WIB,
    year: 'numeric',
    month: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return `${map.year}-${map.month}`;
}

/**
 * Formats any ISO/Date string into standard Indonesian WIB display format
 * e.g. "02 Sep 2026, 09:15 WIB"
 */
export function formatWibDateTime(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: TIMEZONE_WIB,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d) + ' WIB';
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Returns the allowed timesheet submission window [minDate, maxDate] in GMT+07:00 (WIB).
 * Policy: Current active month + 1 week of the following month (1st of current month to 7th of next month).
 * e.g. For September 2026: '2026-09-01' to '2026-10-07'.
 */
export function getTimesheetAllowedDateRange(date: Date = new Date()): { minDate: string; maxDate: string } {
  const wibDate = getWibDateStr(date);
  const [year, month] = wibDate.split('-').map(Number);

  const minDate = `${year}-${String(month).padStart(2, '0')}-01`;

  // Next month calculation (month is 1-based, passing month into Date.UTC index gives next month)
  const nextMonthDate = new Date(Date.UTC(year, month, 7));
  const nextY = nextMonthDate.getUTCFullYear();
  const nextM = String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(nextMonthDate.getUTCDate()).padStart(2, '0');
  const maxDate = `${nextY}-${nextM}-${nextD}`;

  return { minDate, maxDate };
}

/**
 * Checks whether a given 'YYYY-MM-DD' date falls within the allowed timesheet submission window.
 */
export function isTimesheetDateAllowed(dateStr: string, refDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const { minDate, maxDate } = getTimesheetAllowedDateRange(refDate);
  return dateStr >= minDate && dateStr <= maxDate;
}

