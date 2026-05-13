import { Gallery, PhaseType } from './types';

// Storage version: bump when the corresponding data shape changes in a non-back-compatible way.
// v6 resets old milestone data and introduces scheduleMode + empty checkpoints.
export const STORAGE_KEY = 'exhibition_planner_brutalist_v6';
export const LEGACY_STORAGE_KEYS = ['exhibition_planner_brutalist_v5', 'exhibition_planner_brutalist_v4'];
export const LEGACY_MILESTONES_STORAGE_KEYS = ['exhibition_planner_milestones_v4'];
export const CONFIG_STORAGE_KEY = 'exhibition_planner_config_v6';
export const LEGACY_CONFIG_STORAGE_KEYS = ['exhibition_planner_config_v5'];

export const DEFAULT_GALLERIES: Gallery[] = [
  { id: 'gal_feature', name: 'FEATURE GALLERY', kind: 'temporary' },
  { id: 'gal_nat_south', name: 'NATURAL HISTORY SOUTH', kind: 'permanent' },
  { id: 'gal_hum_north', name: 'HUMAN HISTORY NORTH', kind: 'permanent' },
  { id: 'gal_hum_south', name: 'HUMAN HISTORY SOUTH', kind: 'permanent' }
];

export const DEFAULT_PHASE_TYPES: PhaseType[] = [
  { id: 'pt1', label: 'Idea Dev', color: '#94a3b8' },
  { id: 'pt2', label: 'Content Dev', color: '#3b82f6' },
  { id: 'pt3', label: 'Design Dev', color: '#a3cc39' },
  { id: 'pt4', label: 'Implementation', color: '#facc15', isActive: true },
  { id: 'pt5', label: 'Deinstall', color: '#dc2626', isPost: true },
];

export const DEFAULT_MILESTONE_COLOR = '#64748b';

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


export const PRINT_DPI = 96;
export const PRINT_PAGE_SIZES_IN = {
  ledger: { width: 17, height: 11 },
  letter: { width: 11, height: 8.5 },
} as const;
export const PRINT_MARGIN_IN = 0.15;
export const MIN_PRINT_SCALE = 0.4;
export const MIN_READABLE_PRINT_SCALE = 0.75;
export const PRINT_SHELL_PADDING_X = 24;
export const PRINT_SHELL_PADDING_Y = 20;
export const PRINT_COLUMN_GAP = 0;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FY_QUARTERS = ['Q4', 'Q1', 'Q2', 'Q3'];
export const LANE_TOP_PADDING = 4;
export const LANE_BOTTOM_PADDING = 14;
export const BASE_LANE_HEIGHT = 76;
export const COLLAPSED_LANE_HEIGHT = 26;
export const HOLIDAY_LANE_HEIGHT = 48;
export const TRACK_HEIGHT = 54;
export const HEADER_HEIGHT = 70;
export const STANDARD_BAR_HEIGHT = 40;
export const PHASE_BAR_HEIGHT = 8;
export const PHASE_GAP = 0;

// Below this px-per-month value, weekly grid lines are hidden (too dense to read).
// At the 1-year preset (132 px/month) and tighter zooms, weekly lines render between monthly dashes.
export const WEEKLY_GRID_THRESHOLD = 100;
// Hit zone (px) on each edge of project bars and right edge of phase bars for resize.
export const EDGE_HIT_ZONE = 10;
export const GALLERY_HEADER_HEIGHT = 38;

// Status icon strip colours (used on project bars). Picked deliberately OUTSIDE
// the rest of the app palette — phase fills, status pill
// backgrounds, and the bar reds — so the strip reads as a distinct visual
// channel that signals status at a glance.
//   TBC            → violet  #a78bfa
//   In Development → yellow  #fde047 (dark icon for contrast)
//   Open to Public → teal    #2dd4bf
//   Closed         → dark grey #475569
export const getStatusStyles = (status: string) => {
  switch(status) {
    case 'Open to Public': return {
      accent: '#d97706',
      bg: '#fffbeb',
      border: '#f59e0b',
      text: '#78350f',
      label: 'OPEN TO PUBLIC',
      icon: 'ticket',
      iconBg: '#fde047',
      iconText: '#1e293b',
      barBg: '#ef4444',
      barText: '#ffffff'
    };
    case 'In Development': return {
      accent: '#059669',
      bg: '#ecfdf5',
      border: '#10b981',
      text: '#064e3b',
      label: 'IN DEVELOPMENT',
      icon: 'hammer',
      iconBg: '#2dd4bf',
      iconText: '#ffffff',
      barBg: '#fca5a5',
      barText: '#7f1d1d'
    };
    case 'TBC': return {
      accent: '#475569',
      bg: '#f8fafc',
      border: '#94a3b8',
      text: '#1e293b',
      label: 'TBC',
      icon: 'circle-dashed',
      iconBg: '#a78bfa',
      iconText: '#ffffff',
      barBg: '#fee2e2',
      barText: '#991b1b'
    };
    case 'Closed': return {
      accent: '#000000',
      bg: '#f3f4f6',
      border: '#1f2937',
      text: '#000000',
      label: 'CLOSED',
      icon: 'lock',
      iconBg: '#475569',
      iconText: '#ffffff',
      barBg: '#e2e8f0',
      barText: '#0f172a'
    };
    default: return {
      accent: '#94a3b8',
      bg: '#f8fafc',
      border: '#e2e8f0',
      text: '#475569',
      label: '?',
      icon: 'help-circle',
      iconBg: '#94a3b8',
      iconText: '#ffffff',
      barBg: '#94a3b8',
      barText: '#ffffff'
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
