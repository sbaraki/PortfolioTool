import { Exhibition, PhaseType } from '../types';
import { addDays, addMonths, getDaysInMonth, format } from 'date-fns';

const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDateWithMonthDuration = (startDateStr: string, months: number): Date => {
  const start = new Date(startDateStr + 'T12:00:00');
  const wholeMonths = Math.trunc(months);
  const fractionalMonths = months - wholeMonths;
  const afterWholeMonths = addMonths(start, wholeMonths);
  const daysInTargetMonth = getDaysInMonth(afterWholeMonths);
  const fractionalDays = Math.round(fractionalMonths * daysInTargetMonth);
  return addDays(afterWholeMonths, fractionalDays);
};

/**
 * Exports exhibition data to a CSV file.
 * Generates a row per project, phase, and milestone for a "flat" robust log.
 */
export function exportExhibitionsToCSV(exhibitions: Exhibition[], phaseTypes: PhaseType[]) {
  const headers = [
    'Project ID',
    'Project Title',
    'Status',
    'Gallery',
    'Item Type',
    'Item Name',
    'Start Date',
    'End Date',
    'Duration (Months)',
    'Description'
  ];
  
  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '';
    const str = val.toString();
    const escaped = str.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  const allRows: string[][] = [];

  exhibitions.forEach(ex => {
    // 1. Add Main Project Row
    const projectDuration = (() => {
      const start = new Date(ex.startDate + 'T12:00:00');
      const end = new Date(ex.endDate + 'T12:00:00');
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return Math.round((diffDays / (365.25 / 12)) * 10) / 10;
    })();

    allRows.push([
      escapeCSV(ex.exhibitionId),
      escapeCSV(ex.title),
      escapeCSV(ex.status),
      escapeCSV(ex.gallery),
      escapeCSV('Project Main'),
      escapeCSV(ex.title),
      escapeCSV(ex.startDate),
      escapeCSV(ex.endDate),
      escapeCSV(projectDuration),
      escapeCSV(ex.description)
    ]);

    // 2. Add Phase Rows
    const prePhases = (ex.phases || []).filter(p => !phaseTypes.find(t => t.id === p.typeId)?.isPost);
    const postPhases = (ex.phases || []).filter(p => phaseTypes.find(t => t.id === p.typeId)?.isPost);

    // Initial pre-phases flow backwards from startDate
    // Let's resolve their order. Visual order is P1, P2... then StartDate
    // So P1 ends at P2 start. P2 ends at StartDate.
    
    // Calculate total pre duration to find start of P1
    const totalPreMonths = prePhases.reduce((acc, p) => acc + p.durationMonths, 0);
    // Start of P1
    let currentPhaseStart = getDateWithMonthDuration(ex.startDate, -totalPreMonths);

    prePhases.forEach(p => {
      const pEnd = getDateWithMonthDuration(toISODate(currentPhaseStart), p.durationMonths);
      allRows.push([
        escapeCSV(ex.exhibitionId),
        escapeCSV(ex.title),
        escapeCSV(ex.status),
        escapeCSV(ex.gallery),
        escapeCSV('Phase (Pre)'),
        escapeCSV(p.label),
        escapeCSV(toISODate(currentPhaseStart)),
        escapeCSV(toISODate(pEnd)),
        escapeCSV(p.durationMonths),
        escapeCSV('')
      ]);
      currentPhaseStart = pEnd;
    });

    // Post-phases flow forwards from endDate
    let currentPostStart = new Date(ex.endDate + 'T12:00:00');
    postPhases.forEach(p => {
      const pEnd = getDateWithMonthDuration(toISODate(currentPostStart), p.durationMonths);
      allRows.push([
        escapeCSV(ex.exhibitionId),
        escapeCSV(ex.title),
        escapeCSV(ex.status),
        escapeCSV(ex.gallery),
        escapeCSV('Phase (Post)'),
        escapeCSV(p.label),
        escapeCSV(toISODate(currentPostStart)),
        escapeCSV(toISODate(pEnd)),
        escapeCSV(p.durationMonths),
        escapeCSV('')
      ]);
      currentPostStart = pEnd;
    });

    // 3. Add Milestone Rows
    (ex.milestones || []).forEach(m => {
      allRows.push([
        escapeCSV(ex.exhibitionId),
        escapeCSV(ex.title),
        escapeCSV(ex.status),
        escapeCSV(ex.gallery),
        escapeCSV('Milestone'),
        escapeCSV(m.title),
        escapeCSV(m.date),
        escapeCSV(m.date),
        escapeCSV(0),
        escapeCSV('')
      ]);
    });
  });

  const csvContent = [
    headers.join(','),
    ...allRows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `exhibitions_robust_report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
