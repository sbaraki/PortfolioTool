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

export type MilestoneIcon = 'diamond' | 'flag' | 'team' | 'approval' | 'delivery' | 'event';

export interface LocationMilestone {
  id: string;
  gallery: string;
  title: string;
  date: string;
  color?: string;
  icon?: MilestoneIcon;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  date: string;
  color?: string;
  icon?: MilestoneIcon;
}

export interface Exhibition {
  id: string;
  exhibitionId: string;
  title: string;
  status: ExhibitionStatus;
  startDate: string;
  endDate: string;
  gallery: string;
  milestones: ProjectMilestone[];
  phases: ProjectPhase[];
  description?: string;
  isMilestone?: boolean;
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
  footerNote?: string;
}
