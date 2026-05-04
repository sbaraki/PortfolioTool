export type ExhibitionStatus = 'Proposed' | 'In Development' | 'Open to Public' | 'Closed';

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

export interface LocationMilestone {
  id: string;
  gallery: string;
  title: string;
  date: string;
  color?: string;
  icon?: 'diamond' | 'flag';
}

export interface Exhibition {
  id: string;
  exhibitionId: string;
  title: string;
  status: ExhibitionStatus;
  startDate: string;
  endDate: string;
  gallery: string;
  milestones: any[];
  phases: ProjectPhase[];
  description?: string;
}
