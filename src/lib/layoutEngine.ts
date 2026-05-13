import { Exhibition, PhaseType } from '../types';
import { getPositionFromDate } from './dateUtils';
import { PHASE_GAP } from '../constants';

/**
 * Calculates one stable vertical row per project within a gallery lane.
 * The timeline has separate sidebar labels for each project, so sharing a row
 * makes labels unreadable even when the date bars do not overlap.
 */
export const calculateTracks = (
  projects: Exhibition[], 
  monthWidth: number, 
  vMonths: any[], 
  phaseTypes: PhaseType[]
) => {
  const sorted = [...projects]
    .map((project, sourceIndex) => {
      const prePhases = (project.phases || []).filter(phase => !phaseTypes.find(type => type.id === phase.typeId)?.isPost);
      const postPhases = (project.phases || []).filter(phase => phaseTypes.find(type => type.id === phase.typeId)?.isPost);
      const prePhaseWidth = prePhases.reduce((sum, phase) => sum + (phase.durationMonths * monthWidth), 0);
      const postPhaseWidth = postPhases.reduce((sum, phase) => sum + (phase.durationMonths * monthWidth), 0);
      const preGapWidth = Math.max(0, prePhases.length * PHASE_GAP);
      const postGapWidth = Math.max(0, postPhases.length * PHASE_GAP);
      const projectStart = getPositionFromDate(project.startDate, monthWidth, vMonths);
      const projectEnd = getPositionFromDate(project.endDate, monthWidth, vMonths);

      const actualWidth = projectEnd - projectStart;
      const hasPostPhases = postPhases.length > 0;

      // Calculate buffers for markers and labels that extend beyond the project bar.
      let startBuffer = 0;
      let endBuffer = 0;

      if (project.scheduleMode === 'single-date') {
        startBuffer = 10; // diamond offset
        endBuffer = 140;  // title + date label
      } else {
        if (actualWidth < 80 && !hasPostPhases) endBuffer = 120; // external title pill
      }

      return {
        project,
        sourceIndex,
        visualStart: projectStart - prePhaseWidth - preGapWidth - startBuffer,
        visualEnd: projectEnd + postPhaseWidth + postGapWidth + endBuffer,
        laneOrder: Number.isFinite(project.laneOrder) ? project.laneOrder! : null
      };
    })
    .sort((a, b) => {
      if (a.laneOrder !== null && b.laneOrder !== null && a.laneOrder !== b.laneOrder) {
        return a.laneOrder - b.laneOrder;
      }
      if (a.laneOrder !== null && b.laneOrder === null) return -1;
      if (a.laneOrder === null && b.laneOrder !== null) return 1;
      return (
        a.visualStart - b.visualStart ||
        a.visualEnd - b.visualEnd ||
        a.sourceIndex - b.sourceIndex
      );
    });

  const tracks: { [id: string]: number } = {};
  sorted.forEach(({ project }, trackIndex) => {
    tracks[project.id] = trackIndex;
  });

  return { tracks, maxTracks: sorted.length || 1 };
};
