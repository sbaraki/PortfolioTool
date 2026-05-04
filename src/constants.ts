import { Gallery, PhaseType } from './types';

// Storage version: bump when the corresponding data shape changes in a non-back-compatible way.
// CONFIG is at v6 because galleries became Gallery[] objects (id/name/kind) instead of string[].
// Migration in useMuseumSync also accepts older v5 payloads.
export const STORAGE_KEY = 'exhibition_planner_brutalist_v4';
export const MILESTONES_STORAGE_KEY = 'exhibition_planner_milestones_v4';
export const CONFIG_STORAGE_KEY = 'exhibition_planner_config_v6';
export const LEGACY_CONFIG_STORAGE_KEYS = ['exhibition_planner_config_v5'];

export const DEFAULT_GALLERIES: Gallery[] = [
  { id: 'gal_feature', name: 'FEATURE GALLERY', kind: 'temporary' },
  { id: 'gal_nat_south', name: 'NATURAL HISTORY SOUTH', kind: 'permanent' },
  { id: 'gal_hum_north', name: 'HUMAN HISTORY NORTH', kind: 'permanent' },
  { id: 'gal_hum_south', name: 'HUMAN HISTORY SOUTH', kind: 'permanent' }
];

export const DEFAULT_PHASE_TYPES: PhaseType[] = [
  { id: 'pt1', label: 'IDEA DEVELOPMENT', color: '#94a3b8' },
  { id: 'pt2', label: 'CONTENT DEVELOPMENT', color: '#3b82f6' },
  { id: 'pt3', label: 'DESIGN DEVELOPMENT', color: '#a3cc39' },
  { id: 'pt4', label: 'IMPLEMENTATION', color: '#fba84a', isActive: true },
  { id: 'pt5', label: 'DEINSTALL', color: '#fba84a', isPost: true },
];

export const MILESTONE_COLORS = [
  { value: '#dc2626', label: 'CRITICAL / DEFAULT' },
  { value: '#94a3b8', label: 'IDEA / PLANNING' },
  { value: '#3b82f6', label: 'CONTENT / REVIEW' },
  { value: '#22c55e', label: 'DESIGN / APPROVAL' },
  { value: '#f97316', label: 'EXECUTION / BUILD' },
  { value: '#000000', label: 'FINAL / OPENING' },
  { value: '#64748b', label: 'SECONDARY / HOLIDAY' }
];

const pad = (value: number) => String(value).padStart(2, '0');
const toDateString = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const nthWeekdayOfMonth = (year: number, month: number, weekday: number, occurrence: number) => {
  const date = new Date(year, month, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + ((occurrence - 1) * 7));
};
const lastWeekdayBeforeDate = (year: number, month: number, day: number, weekday: number) => {
  const date = new Date(year, month, day);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }
  return date;
};
const calculateEaster = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + (2 * e) + (2 * i) - h - k) % 7;
  const m = Math.floor((a + (11 * h) + (22 * l)) / 451);
  const month = Math.floor((h + l - (7 * m) + 114) / 31) - 1;
  const day = ((h + l - (7 * m) + 114) % 31) + 1;
  return new Date(year, month, day);
};

export const getAlbertaHolidays = (startYear: number, endYear: number) => {
  const holidays: { date: string; label: string; type: string }[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const easter = calculateEaster(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    holidays.push(
      { date: toDateString(year, 0, 1), label: "New Year's Day", type: 'Statutory' },
      { date: toDateString(year, 1, nthWeekdayOfMonth(year, 1, 1, 3).getDate()), label: 'Family Day', type: 'Statutory' },
      { date: toDateString(year, goodFriday.getMonth(), goodFriday.getDate()), label: 'Good Friday', type: 'Statutory' },
      { date: toDateString(year, easterMonday.getMonth(), easterMonday.getDate()), label: 'Easter Monday', type: 'Optional' },
      { date: toDateString(year, 4, lastWeekdayBeforeDate(year, 4, 24, 1).getDate()), label: 'Victoria Day', type: 'Statutory' },
      { date: toDateString(year, 6, 1), label: 'Canada Day', type: 'Statutory' },
      { date: toDateString(year, 7, nthWeekdayOfMonth(year, 7, 1, 1).getDate()), label: 'Heritage Day', type: 'Optional' },
      { date: toDateString(year, 8, nthWeekdayOfMonth(year, 8, 1, 1).getDate()), label: 'Labour Day', type: 'Statutory' },
      { date: toDateString(year, 8, 30), label: 'National Day for Truth and Reconciliation', type: 'Optional' },
      { date: toDateString(year, 9, nthWeekdayOfMonth(year, 9, 1, 2).getDate()), label: 'Thanksgiving Day', type: 'Statutory' },
      { date: toDateString(year, 10, 11), label: 'Remembrance Day', type: 'Statutory' },
      { date: toDateString(year, 11, 25), label: 'Christmas Day', type: 'Statutory' },
      { date: toDateString(year, 11, 26), label: 'Boxing Day', type: 'Optional' }
    );
  }

  return holidays;
};

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const FY_QUARTERS = ['Q4', 'Q1', 'Q2', 'Q3'];
export const MILESTONE_ROW_HEIGHT = 64;
export const LANE_BOTTOM_PADDING = 24;
export const BASE_LANE_HEIGHT = 116;
export const HOLIDAY_LANE_HEIGHT = 72;
export const TRACK_HEIGHT = 34;
export const HEADER_HEIGHT = 100;
export const STANDARD_BAR_HEIGHT = 24;
export const PHASE_BAR_HEIGHT = 12;
export const PHASE_GAP = 3;

export const getStatusStyles = (status: string) => {
  switch(status) {
    case 'Open to Public': return { 
      accent: '#059669', 
      bg: '#ecfdf5', 
      border: '#10b981', 
      text: '#064e3b',
      label: 'OPEN TO PUBLIC',
      icon: 'globe'
    };
    case 'In Development': return { 
      accent: '#d97706', 
      bg: '#fffbeb', 
      border: '#f59e0b', 
      text: '#78350f',
      label: 'IN DEVELOPMENT',
      icon: 'hammer'
    };
    case 'Proposed': return { 
      accent: '#4b5563', 
      bg: '#f9fafb', 
      border: '#d1d5db', 
      text: '#1f2937',
      label: 'PROPOSED',
      icon: 'circle-dashed'
    };
    case 'Closed': return { 
      accent: '#000000', 
      bg: '#f3f4f6', 
      border: '#1f2937', 
      text: '#000000',
      label: 'CLOSED',
      icon: 'lock'
    };
    default: return { 
      accent: '#94a3b8', 
      bg: '#f8fafc', 
      border: '#e2e8f0', 
      text: '#475569',
      label: '?',
      icon: 'help-circle'
    };
  }
};

export const getContrastColor = (hexcolor: string) => {
  if (!hexcolor || hexcolor.length < 7) return 'text-black';
  const r = parseInt(hexcolor.substring(1, 3), 16);
  const g = parseInt(hexcolor.substring(3, 5), 16);
  const b = parseInt(hexcolor.substring(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 160) ? 'text-black' : 'text-white';
};
