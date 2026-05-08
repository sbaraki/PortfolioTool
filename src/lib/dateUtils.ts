import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, isValid } from 'date-fns';

/**
 * Returns a strictly formatted YYYY-MM-DD string.
 */
export const toISODate = (date: Date): string => {
  if (!isValid(date)) return '2026-01-01';
  return format(date, 'yyyy-MM-dd');
};

/**
 * Projects a calendar date into an exact X-axis pixel position based on zoom (monthWidth)
 * Uses a normalized scale where each month box has a fixed width.
 */
export const getPositionFromDate = (dateStr: string, monthWidth: number, vMonths: any[]): number => {
  const date = new Date(dateStr + 'T12:00:00');
  if (!isValid(date) || !vMonths || vMonths.length === 0) return 0;
  
  const start = vMonths[0];
  const startAbs = start.year * 12 + start.month;
  const targetAbs = date.getFullYear() * 12 + date.getMonth();
  const monthDiff = targetAbs - startAbs;
  
  // Progress within the month box: 0.0 at start of Day 1, approaching 1.0 at end of the last day.
  const daysInMonth = getDaysInMonth(date);
  const dayProgress = (date.getDate() - 1) / daysInMonth;
  
  return (monthDiff + dayProgress) * monthWidth;
};

/**
 * Reverses an X-axis pixel position back into a robust calendar date string.
 * Strictly inverse to getPositionFromDate.
 */
export const getDateFromPosition = (x: number, monthWidth: number, vMonths: any[]): string => {
  if (!vMonths || vMonths.length === 0) return toISODate(new Date());
  
  const totalMonthsRel = x / monthWidth;
  const start = vMonths[0];
  const startAbs = start.year * 12 + start.month;
  
  const absoluteTargetMonths = startAbs + totalMonthsRel;
  const targetYear = Math.floor(absoluteTargetMonths / 12);
  const targetMonth = Math.floor(absoluteTargetMonths % 12);
  const monthBoxFrac = absoluteTargetMonths - Math.floor(absoluteTargetMonths);
  
  // Find the exact day within this specific month.
  const baseMonthDate = new Date(targetYear, targetMonth, 1);
  const daysInMonth = getDaysInMonth(baseMonthDate);
  
  // We use floor because an X position within a day box should map to that day.
  // 0.0 -> Day 1, 0.99... -> Last Day
  const day = Math.floor(monthBoxFrac * daysInMonth) + 1;
  const clampedDay = Math.max(1, Math.min(daysInMonth, day));
  
  return toISODate(new Date(targetYear, targetMonth, clampedDay));
};

export const getDateWithMonthDuration = (startDateStr: string, months: number): string => {
  const start = new Date(startDateStr + 'T12:00:00');
  if (!isValid(start)) return startDateStr;

  const wholeMonths = Math.trunc(months);
  const fractionalMonths = months - wholeMonths;
  
  // Step 1: Add whole months. date-fns handles overflowing days (e.g. Jan 31 + 1 month = Feb 28).
  const afterWholeMonths = addMonths(start, wholeMonths);
  
  // Step 2: Handle fractional months relative to the current month the date landed in.
  const daysInTargetMonth = getDaysInMonth(afterWholeMonths);
  const fractionalDays = Math.round(fractionalMonths * daysInTargetMonth);

  return toISODate(addDays(afterWholeMonths, fractionalDays));
};

export const getDurationDays = (startDateStr: string, endDateStr: string): number => {
  const start = new Date(startDateStr + 'T12:00:00');
  const end = new Date(endDateStr + 'T12:00:00');
  if (!isValid(start) || !isValid(end)) return 0;
  return differenceInCalendarDays(end, start);
};

/**
 * Calculates duration in visual "Month Units" relative to the timeline grid.
 * This ensures that a bar spanning Jan 1 to Feb 1 is exactly 1.0 months long visually.
 */
export const getDurationMonths = (startDateStr: string, endDateStr: string): number => {
  // Use a phantom monthWidth of 1 to get the normalized month-unit distance
  const vMonths = [{ year: 2000, month: 0 }]; // arbitrary base
  const startPos = getPositionFromDate(startDateStr, 1, vMonths);
  const endPos = getPositionFromDate(endDateStr, 1, vMonths);
  
  const diff = endPos - startPos;
  // Round to nearest 0.1 for clean data
  return Math.max(0, Math.round(diff * 10) / 10);
};

/**
 * Formats date for UI display (e.g., JAN 1, 2026)
 */
export const formatBarDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  if (!isValid(date)) return '---';
  return format(date, 'eee, MMM d, yyyy').toUpperCase();
};

/**
 * Returns the ISO-week start (Monday) for the given ISO date string.
 */
export const getISOWeekStart = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  if (!isValid(date)) return dateStr;
  // Monday = 1, Sunday = 0 → shift Sunday to be 7 so we always step back to Monday.
  const day = date.getDay() || 7;
  return toISODate(addDays(date, 1 - day));
};

/**
 * Snap an ISO date string to the requested granularity.
 * - 'day' is a no-op (returns the date as-is).
 * - 'week' rounds to the nearest Monday (forward 1-3 days, back 0-3 days).
 */
export const snapDate = (dateStr: string, mode: 'day' | 'week'): string => {
  if (mode === 'day') return dateStr;
  const date = new Date(dateStr + 'T12:00:00');
  if (!isValid(date)) return dateStr;
  const day = date.getDay() || 7;
  // 1 = Monday → 0 offset; 2 = Tue → -1 or +6 (we round to nearest)
  const backToMonday = 1 - day; // negative or zero
  const fwdToMonday = 8 - day; // 1..7
  const offset = Math.abs(backToMonday) <= Math.abs(fwdToMonday) ? backToMonday : fwdToMonday;
  return toISODate(addDays(date, offset));
};
