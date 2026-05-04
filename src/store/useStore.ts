import { create } from 'zustand';
import { Exhibition, Gallery, PhaseType, LocationMilestone, ExhibitionStatus } from '../types';
import { DEFAULT_GALLERIES, DEFAULT_PHASE_TYPES } from '../constants';

interface AppState {
  // Config State
  museumName: string;
  galleries: Gallery[];
  phaseTypes: PhaseType[];

  // Timeline State
  exhibitions: Exhibition[];
  locationMilestones: LocationMilestone[];

  // UI & Filter State
  monthWidth: number;
  timelineStartDate: string;
  timelineEndDate: string;
  searchQuery: string;
  statusFilter: ExhibitionStatus | 'All';
  showConflicts: boolean;

  // Actions
  setMuseumName: (name: string) => void;
  setExhibitions: (exhibitions: Exhibition[] | ((prev: Exhibition[]) => Exhibition[])) => void;
  setGalleries: (galleries: Gallery[] | ((prev: Gallery[]) => Gallery[])) => void;
  setPhaseTypes: (types: PhaseType[] | ((prev: PhaseType[]) => PhaseType[])) => void;
  setLocationMilestones: (milestones: LocationMilestone[] | ((prev: LocationMilestone[]) => LocationMilestone[])) => void;

  setMonthWidth: (width: number | ((prev: number) => number)) => void;
  setTimelineStartDate: (date: string) => void;
  setTimelineEndDate: (date: string) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: ExhibitionStatus | 'All') => void;
  setShowConflicts: (show: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  museumName: 'NATIONAL HERITAGE TRUST',
  galleries: DEFAULT_GALLERIES,
  phaseTypes: DEFAULT_PHASE_TYPES,
  
  exhibitions: [],
  locationMilestones: [],
  
  monthWidth: 120,
  timelineStartDate: '2026-01-01',
  timelineEndDate: '2030-12-31',
  searchQuery: '',
  statusFilter: 'All',
  showConflicts: true,

  setMuseumName: (name) => set({ museumName: name }),
  setExhibitions: (updater) => set((state) => ({ 
    exhibitions: typeof updater === 'function' ? updater(state.exhibitions) : updater 
  })),
  setGalleries: (updater) => set((state) => ({ 
    galleries: typeof updater === 'function' ? updater(state.galleries) : updater 
  })),
  setPhaseTypes: (updater) => set((state) => ({ 
    phaseTypes: typeof updater === 'function' ? updater(state.phaseTypes) : updater 
  })),
  setLocationMilestones: (updater) => set((state) => ({ 
    locationMilestones: typeof updater === 'function' ? updater(state.locationMilestones) : updater 
  })),
  
  setMonthWidth: (updater) => set((state) => ({ 
    monthWidth: typeof updater === 'function' ? updater(state.monthWidth) : updater 
  })),
  setTimelineStartDate: (date) => set({ timelineStartDate: date }),
  setTimelineEndDate: (date) => set({ timelineEndDate: date }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setShowConflicts: (show) => set({ showConflicts: show }),
}));
