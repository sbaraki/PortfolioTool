import { Exhibition, PhaseType } from '../types';
import { formatBarDate, getPositionFromDate } from './dateUtils';
import { MILESTONE_LABEL_MAX_WIDTH, PHASE_GAP } from '../constants';

/**
 * Calculates collision-free independent tracks for exhibitions sharing the same gallery lane.
 * It strictly avoids overlaps by sorting and stepping projects down a Y-axis track.
 */
export const calculateTracks = (
  projects: Exhibition[], 
  monthWidth: number, 
  vMonths: any[], 
  phaseTypes: PhaseType[]
) => {
  const sorted = [...projects]
    .map((project) => {
      const prePhases = (project.phases || []).filter(phase => !phaseTypes.find(type => type.id === phase.typeId)?.isPost);
      const postPhases = (project.phases || []).filter(phase => phaseTypes.find(type => type.id === phase.typeId)?.isPost);
      const prePhaseWidth = prePhases.reduce((sum, phase) => sum + (phase.durationMonths * monthWidth), 0);
      const postPhaseWidth = postPhases.reduce((sum, phase) => sum + (phase.durationMonths * monthWidth), 0);
      const preGapWidth = Math.max(0, prePhases.length * PHASE_GAP);
      const postGapWidth = Math.max(0, postPhases.length * PHASE_GAP);
      const projectStart = getPositionFromDate(project.startDate, monthWidth, vMonths);
      const projectEnd = getPositionFromDate(project.endDate, monthWidth, vMonths);

      return {
        project,
        visualStart: projectStart - prePhaseWidth - preGapWidth,
        visualEnd: projectEnd + postPhaseWidth + postGapWidth,
        requiredTracks: prePhases.length + 1
      };
    })
    .sort((a, b) => a.visualStart - b.visualStart || a.visualEnd - b.visualEnd);

  const tracks: { [id: string]: number } = {};
  const trackAvailability: number[] = [];

  sorted.forEach(({ project, visualStart, visualEnd, requiredTracks }) => {
    let startTrack = 0;

    while (true) {
      let canFit = true;

      for (let index = 0; index < requiredTracks; index += 1) {
        const availability = trackAvailability[startTrack + index] ?? Number.NEGATIVE_INFINITY;
        if (availability > visualStart) {
          canFit = false;
          startTrack += 1;
          break;
        }
      }

      if (canFit) {
        tracks[project.id] = startTrack;
        for (let index = 0; index < requiredTracks; index += 1) {
          trackAvailability[startTrack + index] = visualEnd;
        }
        return;
      }
    }
  });

  return { tracks, maxTracks: trackAvailability.length || 1 };
};

export type MilestoneLabelMetrics = {
  labelWidth: number;
  labelFontSize: number;
  dateFontSize: number;
  isCompact: boolean;
  isTwoLine: boolean;
};

export type PackedMilestoneLabel<T> = T & {
  xPos: number;
  labelRow: number;
} & MilestoneLabelMetrics;

const LABEL_HORIZONTAL_PADDING = 14;
const LABEL_SINGLE_LINE_CHROME = LABEL_HORIZONTAL_PADDING + 12; // separator + gap
const LABEL_TWO_LINE_CHROME = LABEL_HORIZONTAL_PADDING;
const LABEL_MIN_WIDTH = 68;

const estimateTextWidth = (text: string, fontSize: number, weight: 'medium' | 'semibold' = 'medium') => {
  const weightMultiplier = weight === 'semibold' ? 0.62 : 0.56;
  return (text || '').length * fontSize * weightMultiplier;
};

export const estimateMilestoneLabelWidth = (title: string) => {
  // Labels render as compact two-line pills (title over date), so width is driven
  // by the longer title/date line instead of the previous inline title + date sum.
  const titleW = (title || '').length * 5.4;
  return Math.min(MILESTONE_LABEL_MAX_WIDTH, Math.max(72, titleW + 20));
/**
 * Estimates the milestone label width from both title and formatted date, returning
 * the sizing metadata used by the renderer. Labels stay single-line when the
 * available max width permits it, progressively reduce font sizes in tight packs,
 * and fall back to a compact two-line layout when the title/date pair is still
 * too wide.
 */
export const estimateMilestoneLabelWidth = (title: string, date?: string): MilestoneLabelMetrics => {
  const formattedDate = date ? formatBarDate(date) : '';
  const singleLineOptions = [
    { labelFontSize: 9, dateFontSize: 8.5 },
    { labelFontSize: 8.25, dateFontSize: 7.75 },
    { labelFontSize: 7.5, dateFontSize: 7 },
  ];

  for (const option of singleLineOptions) {
    const titleWidth = estimateTextWidth(title, option.labelFontSize, 'semibold');
    const dateWidth = estimateTextWidth(formattedDate, option.dateFontSize);
    const desiredWidth = Math.ceil(titleWidth + dateWidth + LABEL_SINGLE_LINE_CHROME);

    if (desiredWidth <= MILESTONE_LABEL_MAX_WIDTH) {
      return {
        labelWidth: Math.max(LABEL_MIN_WIDTH, desiredWidth),
        labelFontSize: option.labelFontSize,
        dateFontSize: option.dateFontSize,
        isCompact: option.labelFontSize < singleLineOptions[0].labelFontSize,
        isTwoLine: false,
      };
    }
  }

  const compact = singleLineOptions[singleLineOptions.length - 1];
  const compactTitleWidth = estimateTextWidth(title, compact.labelFontSize, 'semibold');
  const compactDateWidth = estimateTextWidth(formattedDate, compact.dateFontSize);
  const compactTwoLineWidth = Math.ceil(Math.max(compactTitleWidth, compactDateWidth) + LABEL_TWO_LINE_CHROME);

  return {
    labelWidth: Math.max(LABEL_MIN_WIDTH, Math.min(MILESTONE_LABEL_MAX_WIDTH, compactTwoLineWidth)),
    labelFontSize: compact.labelFontSize,
    dateFontSize: compact.dateFontSize,
    isCompact: true,
    isTwoLine: true,
  };
};

/**
 * Greedily packs dated milestone labels into as many rows as needed. Unlike the old
 * two-row alternation, this returns a deterministic row index and row count so lanes
 * can reserve enough vertical space before labels render.
 */
export const packMilestoneLabels = <T extends { title: string; date: string; xPos: number }>(
  milestones: T[],
  gap = 8
): { items: PackedMilestoneLabel<T>[]; rowCount: number } => {
  const sorted = [...milestones]
    .map(item => ({ ...item, ...estimateMilestoneLabelWidth(item.title, item.date), labelRow: 0 }))
    .sort((a, b) => a.xPos - b.xPos);

  const rowRightEdges: number[] = [];

  const items = sorted.map(item => {
    const left = item.xPos - item.labelWidth / 2;
    const right = item.xPos + item.labelWidth / 2;
    let row = rowRightEdges.findIndex(edge => left - gap >= edge);
    if (row === -1) {
      row = rowRightEdges.length;
      rowRightEdges.push(Number.NEGATIVE_INFINITY);
    }
    rowRightEdges[row] = right;
    return { ...item, labelRow: row };
  });

  return { items, rowCount: Math.max(1, rowRightEdges.length) };
};
