export type ExhibitionStatus = 'TBC' | 'In Development' | 'Open to Public' | 'Closed';

export type GalleryKind = 'permanent' | 'temporary';

export interface Gallery {
  id: string;
  name: string;
  kind: GalleryKind;
}

export interface PhaseType {
  id: string;
  label: string;
  color: string;
  isPost?: boolean;
  isActive?: boolean;
}

export interface ProjectPhase {
  id: string;
  label: string;
  durationMonths: number;
  typeId: string;
}

export type ProjectScheduleMode = 'range' | 'single-date';

export type CheckpointKind = 'kickoff' | 'review' | 'approval' | 'install' | 'opening' | 'close' | 'other';

export interface ProjectCheckpoint {
  title: string;
  date: string;
  id: string;
  kind: CheckpointKind;
  color?: string;
}

export interface Exhibition {
  id: string;
  exhibitionId: string;
  title: string;
  status: ExhibitionStatus;
  startDate: string;
  endDate: string;
  gallery: string;
  scheduleMode: ProjectScheduleMode;
  checkpoints: ProjectCheckpoint[];
  phases: ProjectPhase[];
  laneOrder?: number;
  description?: string;
}


export type PrintPaperSize = 'ledger' | 'letter';
export type PrintOrientation = 'landscape' | 'portrait';
export type PrintLaneBehavior = 'current' | 'expand-all' | 'selected-only';

export interface PrintSettings {
  paperSize: PrintPaperSize;
  orientation: PrintOrientation;
  statuses: ExhibitionStatus[];
  selectedGalleryIds: string[];
  laneBehavior: PrintLaneBehavior;
  includeLegends: boolean;
  includeSummary: boolean;
  grayscale: boolean;
  showPhases: boolean;
  showDescription: boolean;
  fontSizeMultiplier: number;
  projectRowGap: number;
  footerNote?: string;
}
