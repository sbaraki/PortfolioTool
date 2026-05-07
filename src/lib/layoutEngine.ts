import { Exhibition, PhaseType } from '../types';
import { getPositionFromDate } from './dateUtils';
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

export type PackedMilestoneLabel<T> = T & {
  xPos: number;
  labelWidth: number;
  labelRow: number;
};

export const estimateMilestoneLabelWidth = (title: string) => {
  const titleW = (title || '').length * 5.8;
  return Math.min(MILESTONE_LABEL_MAX_WIDTH, Math.max(60, titleW + 82));
};

/**
 * Greedily packs dated milestone labels into as many rows as needed. Unlike the old
 * two-row alternation, this returns a deterministic row index and row count so lanes
 * can reserve enough vertical space before labels render.
 */
export const packMilestoneLabels = <T extends { title: string; xPos: number }>(
  milestones: T[],
  gap = 8
): { items: PackedMilestoneLabel<T>[]; rowCount: number } => {
  const sorted = [...milestones]
    .map(item => ({ ...item, labelWidth: estimateMilestoneLabelWidth(item.title), labelRow: 0 }))
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
