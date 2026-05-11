import { Exhibition, PhaseType } from '../types';
import { getPositionFromDate } from './dateUtils';
import { PHASE_GAP } from '../constants';

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

      const actualWidth = projectEnd - projectStart;
      const hasPrePhases = prePhases.length > 0;
      const hasPostPhases = postPhases.length > 0;
      
      // Calculate buffers for labels that extend beyond the bars/phases
      let startBuffer = 0;
      let endBuffer = 0;

      if (project.scheduleMode === 'single-date') {
        startBuffer = 10; // diamond offset
        endBuffer = 140;  // title + date label
      } else {
        if (hasPrePhases) startBuffer = 120; // pre-phase labels
        if (hasPostPhases) endBuffer = 120;  // post-phase labels
        if (actualWidth < 80 && !hasPostPhases) endBuffer = 120; // external title pill
      }

      return {
        project,
        visualStart: projectStart - prePhaseWidth - preGapWidth - startBuffer,
        visualEnd: projectEnd + postPhaseWidth + postGapWidth + endBuffer,
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
