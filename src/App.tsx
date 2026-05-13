import { useStore } from './store/useStore';
import { useMuseumSync } from './hooks/useMuseumSync';
import { useMuseumActions } from './hooks/useMuseumActions';
import { getStatusStyles, MONTHS, FY_QUARTERS, BASE_LANE_HEIGHT, COLLAPSED_LANE_HEIGHT, TRACK_HEIGHT, HEADER_HEIGHT, STANDARD_BAR_HEIGHT, LANE_TOP_PADDING, LANE_BOTTOM_PADDING, PHASE_GAP, WEEKLY_GRID_THRESHOLD, EDGE_HIT_ZONE, GALLERY_HEADER_HEIGHT, PRINT_DPI, PRINT_PAGE_SIZES_IN, PRINT_MARGIN_IN, MIN_PRINT_SCALE, MIN_READABLE_PRINT_SCALE, PRINT_SHELL_PADDING_X, PRINT_SHELL_PADDING_Y, PRINT_COLUMN_GAP } from './constants';
import { toISODate, getPositionFromDate, getDateFromPosition, formatBarDate, getDateWithMonthDuration, getDurationDays, getDurationMonths, snapDate } from './lib/dateUtils';
import { calculateTracks } from './lib/layoutEngine';
import { calculatePrintScale } from './lib/printLayout';
import { exportExhibitionsToCSV } from './lib/exportUtils';
import { CheckpointKind, Exhibition, Gallery, GalleryKind, ProjectCheckpoint, ProjectPhase, PhaseType, ExhibitionStatus, PrintSettings } from './types';
import { DetailPanel } from './components/DetailPanel';
import { DatePicker } from './components/DatePicker';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { 
  Plus, 
  X,
  User,
  MapPin,
  Trash2,
  Check,
  Edit2,
  Building2,
  Settings,
  ZoomIn,
  ZoomOut,
  Printer,
  Calendar,
  Eye,
  CalendarOff,
  RefreshCw,
  CircleCheck,
  Copy,
  Clock,
  Layers,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Palette,
  Info,
  Search,
  Undo,
  Redo,
  Download,
  MoreVertical,
  GripVertical,
  Flag,
  Users,
  BadgeCheck,
  Truck,
  Star,
  LogOut,
  LogIn,
  Cloud,
  CloudOff,
  History,
  FileText
} from 'lucide-react';

import { GithubAuthModal } from './components/GithubAuthModal';

// --- Main App ---

const ALL_STATUSES: ExhibitionStatus[] = ['TBC', 'In Development', 'Open to Public', 'Closed'];

const MILESTONE_KIND_META: Record<CheckpointKind, {
  label: string;
  Icon: React.ElementType;
  markerClass: string;
  iconClass: string;
  labelBorderClass: string;
}> = {
  kickoff: {
    label: 'Kickoff',
    Icon: Flag,
    markerClass: 'bg-sky-600',
    iconClass: 'bg-sky-50 text-sky-700 border-sky-200',
    labelBorderClass: 'border-sky-200',
  },
  review: {
    label: 'Review',
    Icon: Eye,
    markerClass: 'bg-violet-600',
    iconClass: 'bg-violet-50 text-violet-700 border-violet-200',
    labelBorderClass: 'border-violet-200',
  },
  approval: {
    label: 'Approval',
    Icon: BadgeCheck,
    markerClass: 'bg-emerald-600',
    iconClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    labelBorderClass: 'border-emerald-200',
  },
  install: {
    label: 'Install',
    Icon: Truck,
    markerClass: 'bg-amber-600',
    iconClass: 'bg-amber-50 text-amber-700 border-amber-200',
    labelBorderClass: 'border-amber-200',
  },
  opening: {
    label: 'Opening',
    Icon: Star,
    markerClass: 'bg-rose-600',
    iconClass: 'bg-rose-50 text-rose-700 border-rose-200',
    labelBorderClass: 'border-rose-200',
  },
  close: {
    label: 'Close',
    Icon: CircleCheck,
    markerClass: 'bg-slate-700',
    iconClass: 'bg-slate-50 text-slate-700 border-slate-200',
    labelBorderClass: 'border-slate-300',
  },
  other: {
    label: 'Other',
    Icon: Clock,
    markerClass: 'bg-red-600',
    iconClass: 'bg-red-50 text-red-700 border-red-200',
    labelBorderClass: 'border-red-200',
  },
};

const formatMilestoneDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr || '---';
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
};

type TimelineRect = { x: number; y: number; width: number; height: number };

const timelineRectsOverlap = (a: TimelineRect, b: TimelineRect, padding = 4) => (
  a.x < b.x + b.width + padding &&
  a.x + a.width + padding > b.x &&
  a.y < b.y + b.height + padding &&
  a.y + a.height + padding > b.y
);

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'ledger',
  orientation: 'landscape',
  statuses: ALL_STATUSES,
  selectedGalleryIds: [],
  laneBehavior: 'current',
  includeLegends: true,
  includeSummary: false,
  grayscale: false,
  showPhases: true,
  showDescription: false,
  fontSizeMultiplier: 1,
  projectRowGap: 16,
  footerNote: '',
};

const PRINT_MILESTONE_LABEL_HEIGHT = 24;
const PRINT_MILESTONE_ROW_TOP = 8;
const PRINT_MILESTONE_ROW_GAP = 30;
const PRINT_MILESTONE_BAND_PADDING_BOTTOM = 10;
const MIN_PRINT_MILESTONE_ROWS = 3;
const SCREEN_MILESTONE_BAND_HEIGHT = 82;
const SCREEN_MILESTONE_LABEL_HEIGHT = 22;
const SCREEN_MILESTONE_LABEL_ROWS = [7, 34, 61];
const PHASE_TINT_HEIGHT = 5;

const formatPrintDateTime = (date: Date | null) => {
  if (!date) return 'Preparing print';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

type QuickPopoverState =
  | { mode: 'project'; projectId: string; x: number; y: number }
  | { mode: 'add-project'; galleryName: string; date: string; x: number; y: number }
  | { mode: 'milestone'; projectId: string; checkpointId?: string; date: string; x: number; y: number };

const POPOVER_WIDTH = 320;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const createLocalId = () => Math.random().toString(36).slice(2, 11);
const clampPopoverPosition = (x: number, y: number) => ({
  left: Math.max(8, Math.min(x + 10, window.innerWidth - POPOVER_WIDTH - 8)),
  top: Math.max(48, Math.min(y + 10, window.innerHeight - 360)),
});
const isValidDateInput = (value: string) => {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
};
const sortProjectCheckpoints = (checkpoints: Exhibition['checkpoints']) => (
  [...(checkpoints || [])].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
);

const QuickProjectPopover = ({
  project,
  galleries,
  anchor,
  onUpdate,
  onClose,
  onOpenMilestone,
}: {
  project: Exhibition;
  galleries: Gallery[];
  anchor: { x: number; y: number };
  onUpdate: (project: Exhibition) => void;
  onClose: () => void;
  onOpenMilestone: (date: string) => void;
}) => {
  const [draft, setDraft] = useState(project);
  const [dateError, setDateError] = useState('');
  const saveTimerRef = useRef<number | null>(null);
  const draftRef = useRef(project);
  const onUpdateRef = useRef(onUpdate);
  const position = clampPopoverPosition(anchor.x, anchor.y);
  const duration = getDurationMonths(draft.startDate, draft.endDate);

  useEffect(() => {
    setDraft(project);
    draftRef.current = project;
  }, [project]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      onUpdateRef.current(draftRef.current);
    }
  }, []);

  const save = (next: Exhibition, immediate = false) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (immediate) {
      onUpdate(next);
      return;
    }
    saveTimerRef.current = window.setTimeout(() => onUpdate(next), 500);
  };

  const updateDraft = (updater: Exhibition | ((prev: Exhibition) => Exhibition), immediate = false) => {
    const next = typeof updater === 'function' ? updater(draftRef.current) : updater;
    draftRef.current = next;
    setDraft(next);
    save(next, immediate);
  };

  const applyDate = (field: 'startDate' | 'endDate', value: string) => {
    if (!isValidDateInput(value)) {
      setDateError('Use YYYY-MM-DD');
      return;
    }
    setDateError('');
    updateDraft(prev => {
      if (field === 'startDate') {
        return {
          ...prev,
          startDate: value,
          endDate: prev.scheduleMode === 'single-date' ? value : (prev.endDate < value ? value : prev.endDate),
        };
      }
      return { ...prev, endDate: value < prev.startDate ? prev.startDate : value };
    }, true);
  };

  return (
    <div
      data-quick-popover
      className="fixed z-[160] w-[320px] border border-slate-300 bg-white shadow-2xl no-print"
      style={position}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-800">Quick edit</span>
        <button aria-label="Close quick edit" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
          <X size={13} />
        </button>
      </div>
      <div className="space-y-2 p-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">Title</span>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => updateDraft(prev => ({ ...prev, title: e.target.value.toUpperCase() }))}
            onBlur={() => onUpdate(draftRef.current)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onUpdate(draftRef.current);
                e.currentTarget.blur();
              }
            }}
            className="w-full border border-slate-200 px-2 py-1.5 text-[12px] font-semibold uppercase outline-none focus:border-slate-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">Status</span>
            <select
              value={draft.status}
              onChange={(e) => updateDraft(prev => ({ ...prev, status: e.target.value as ExhibitionStatus }), true)}
              className="w-full border border-slate-200 px-2 py-1.5 text-[12px] bg-white outline-none focus:border-slate-500"
            >
              {ALL_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">Gallery</span>
            <select
              value={draft.gallery}
              onChange={(e) => updateDraft(prev => ({ ...prev, gallery: e.target.value }), true)}
              className="w-full border border-slate-200 px-2 py-1.5 text-[12px] bg-white outline-none focus:border-slate-500"
            >
              {galleries.map(gallery => <option key={gallery.id} value={gallery.name}>{gallery.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            { value: 'range', label: 'Date range' },
            { value: 'single-date', label: 'Single date' },
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateDraft(prev => {
                const scheduleMode = option.value as Exhibition['scheduleMode'];
                return {
                  ...prev,
                  scheduleMode,
                  endDate: scheduleMode === 'single-date'
                    ? prev.startDate
                    : (prev.endDate <= prev.startDate ? getDateWithMonthDuration(prev.startDate, 3) : prev.endDate)
                };
              }, true)}
              className={`border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-tight ${draft.scheduleMode === option.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {draft.scheduleMode === 'single-date' ? (
          <DatePicker value={draft.startDate} onChange={(value) => applyDate('startDate', value)} onBlur={(value) => applyDate('startDate', value)} error={dateError} label="Date" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <DatePicker value={draft.startDate} onChange={(value) => applyDate('startDate', value)} onBlur={(value) => applyDate('startDate', value)} error={dateError} label="Start" />
            <DatePicker value={draft.endDate} onChange={(value) => applyDate('endDate', value)} onBlur={(value) => applyDate('endDate', value)} error={dateError} label="End" />
          </div>
        )}
        {draft.scheduleMode !== 'single-date' && (
          <label className="flex items-center gap-2 border-t border-slate-100 pt-2">
            <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">Duration</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={duration}
              onChange={(e) => {
                const months = parseFloat(e.target.value);
                if (!Number.isNaN(months)) updateDraft(prev => ({ ...prev, endDate: getDateWithMonthDuration(prev.startDate, Math.max(0.1, months)) }));
              }}
              onBlur={() => onUpdate(draftRef.current)}
              className="w-20 border border-slate-200 px-2 py-1 text-[12px] outline-none focus:border-slate-500"
            />
            <span className="text-[10px] uppercase text-slate-500">months</span>
          </label>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-[10px] font-medium uppercase tracking-tight text-emerald-700">Auto-saves</span>
          <button
            type="button"
            onClick={() => onOpenMilestone(draft.startDate)}
            className="inline-flex items-center gap-1 border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-tight text-slate-700 hover:bg-slate-50"
          >
            <Flag size={10} /> Milestone
          </button>
        </div>
      </div>
    </div>
  );
};

const QuickAddProjectPopover = ({
  anchor,
  galleryName,
  date,
  phaseTypes,
  onCreate,
  onClose,
}: {
  anchor: { x: number; y: number };
  galleryName: string;
  date: string;
  phaseTypes: PhaseType[];
  onCreate: (project: Exhibition) => void;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState('NEW PROJECT');
  const [status, setStatus] = useState<ExhibitionStatus>('TBC');
  const [scheduleMode, setScheduleMode] = useState<Exhibition['scheduleMode']>('range');
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(getDateWithMonthDuration(date, 3));
  const [dateError, setDateError] = useState('');
  const position = clampPopoverPosition(anchor.x, anchor.y);

  const createProject = () => {
    if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) {
      setDateError('Use YYYY-MM-DD');
      return;
    }
    const id = createLocalId();
    onCreate({
      id,
      exhibitionId: '',
      title: title.trim().toUpperCase() || 'NEW PROJECT',
      status,
      startDate,
      endDate: scheduleMode === 'single-date' ? startDate : (endDate < startDate ? startDate : endDate),
      gallery: galleryName,
      scheduleMode,
      checkpoints: [],
      phases: phaseTypes.map(pt => ({
        id: createLocalId(),
        label: pt.label,
        durationMonths: pt.isPost ? 1 : 3,
        typeId: pt.id,
      })),
      description: '',
    });
    onClose();
  };

  return (
    <div data-quick-popover className="fixed z-[160] w-[320px] border border-slate-300 bg-white shadow-2xl no-print" style={position} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-800">Quick add</span>
        <button aria-label="Close quick add" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900"><X size={13} /></button>
      </div>
      <div className="space-y-2 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-tight text-slate-500">{galleryName}</div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              createProject();
            }
          }}
          className="w-full border border-slate-200 px-2 py-1.5 text-[12px] font-semibold uppercase outline-none focus:border-slate-500"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as ExhibitionStatus)} className="w-full border border-slate-200 px-2 py-1.5 text-[12px] bg-white outline-none focus:border-slate-500">
          {ALL_STATUSES.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => setScheduleMode('range')} className={`border px-2 py-1.5 text-[10px] font-semibold uppercase ${scheduleMode === 'range' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>Range</button>
          <button type="button" onClick={() => setScheduleMode('single-date')} className={`border px-2 py-1.5 text-[10px] font-semibold uppercase ${scheduleMode === 'single-date' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>Single</button>
        </div>
        {scheduleMode === 'single-date' ? (
          <DatePicker value={startDate} onChange={setStartDate} onBlur={setStartDate} error={dateError} label="Date" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <DatePicker value={startDate} onChange={(value) => { setStartDate(value); if (endDate < value) setEndDate(value); }} onBlur={(value) => { setStartDate(value); if (endDate < value) setEndDate(value); }} error={dateError} label="Start" />
            <DatePicker value={endDate} onChange={(value) => setEndDate(value < startDate ? startDate : value)} onBlur={(value) => setEndDate(value < startDate ? startDate : value)} error={dateError} label="End" />
          </div>
        )}
        <button type="button" onClick={createProject} className="w-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-tight text-white hover:bg-slate-800">
          Create project
        </button>
      </div>
    </div>
  );
};

const QuickMilestonePopover = ({
  anchor,
  project,
  checkpoint,
  date,
  onUpdate,
  onClose,
}: {
  anchor: { x: number; y: number };
  project: Exhibition;
  checkpoint?: Exhibition['checkpoints'][number];
  date: string;
  onUpdate: (project: Exhibition) => void;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(checkpoint?.title || 'NEW MILESTONE');
  const [kind, setKind] = useState<CheckpointKind>(checkpoint?.kind || 'other');
  const [milestoneDate, setMilestoneDate] = useState(checkpoint?.date || date);
  const [dateError, setDateError] = useState('');
  const checkpointIdRef = useRef(checkpoint?.id || createLocalId());
  const position = clampPopoverPosition(anchor.x, anchor.y);

  const saveMilestone = (closeAfter = false, overrides: Partial<ProjectCheckpoint> = {}) => {
    const nextDate = overrides.date || milestoneDate;
    const nextTitle = overrides.title || title;
    const nextKind = overrides.kind || kind;
    if (!isValidDateInput(nextDate)) {
      setDateError('Use YYYY-MM-DD');
      return;
    }
    const nextCheckpoint = {
      id: checkpointIdRef.current,
      title: nextTitle.trim().toUpperCase() || 'NEW MILESTONE',
      kind: nextKind,
      date: nextDate,
    };
    const exists = (project.checkpoints || []).some(item => item.id === checkpointIdRef.current);
    const checkpoints = exists
      ? project.checkpoints.map(item => item.id === checkpointIdRef.current ? nextCheckpoint : item)
      : [...(project.checkpoints || []), nextCheckpoint];
    onUpdate({ ...project, checkpoints: sortProjectCheckpoints(checkpoints) });
    if (closeAfter) onClose();
  };

  return (
    <div data-quick-popover className="fixed z-[160] w-[320px] border border-slate-300 bg-white shadow-2xl no-print" style={position} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-800">{checkpoint ? 'Edit milestone' : 'Add milestone'}</span>
        <button aria-label="Close milestone editor" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900"><X size={13} /></button>
      </div>
      <div className="space-y-2 p-3">
        <div className="truncate text-[10px] font-semibold uppercase tracking-tight text-slate-500" title={project.title}>{project.title}</div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value.toUpperCase())}
          onBlur={() => {
            if (checkpoint) saveMilestone(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveMilestone(true);
            }
          }}
          className="w-full border border-slate-200 px-2 py-1.5 text-[12px] font-semibold uppercase outline-none focus:border-slate-500"
        />
        <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    value={milestoneDate}
                    onChange={(value) => {
                      setMilestoneDate(value);
                      if (checkpoint) saveMilestone(false, { date: value });
                    }}
                    onBlur={(value) => {
                      setMilestoneDate(value);
                      if (checkpoint) saveMilestone(false, { date: value });
                    }}
                    error={dateError}
                    label="Date"
                  />
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">Kind</span>
            <select
              value={kind}
              onChange={(e) => {
                const nextKind = e.target.value as CheckpointKind;
                setKind(nextKind);
                if (checkpoint) saveMilestone(false, { kind: nextKind });
              }}
              className="w-full border border-slate-200 px-2 py-1.5 text-[12px] bg-white outline-none focus:border-slate-500"
            >
              {Object.entries(MILESTONE_KIND_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </label>
        </div>
        <button type="button" onClick={() => saveMilestone(true)} className="w-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-tight text-white hover:bg-slate-800">
          {checkpoint ? 'Save milestone' : 'Add milestone'}
        </button>
      </div>
    </div>
  );
};

export default function MasterScheduler() {
  const SIDEBAR_WIDTH = 220;
  const { currentUser, syncStatus } = useMuseumSync();
  const syncLabel = syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'error' ? 'Sync error' : syncStatus === 'synced' ? 'Synced' : 'Connecting';
  const syncDotClass = syncStatus === 'error' ? 'bg-red-500' : syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-blue-500';

  const {
    museumName, setMuseumName,
    galleries, setGalleries,
    phaseTypes, setPhaseTypes,
    exhibitions, setExhibitions,
    monthWidth, setMonthWidth,
    timelineStartDate, setTimelineStartDate,
    timelineEndDate, setTimelineEndDate,
    commitHistory, undo, redo, historyPast, historyFuture,
    showConflicts, setShowConflicts,
  } = useStore();
  const { handleUpdateExhibition, handleRemoveExhibition, handleRenameGallery, handleSetGalleryKind, handleAddGallery, handleRemoveGallery, handleDuplicateProject } = useMuseumActions();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'settings'>('portfolio');
  const [showGithubAuth, setShowGithubAuth] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [quickPopover, setQuickPopover] = useState<QuickPopoverState | null>(null);
  
  const currentTrackHeight = isPrintMode 
    ? (Math.max(STANDARD_BAR_HEIGHT, (printSettings.showDescription ? 34 : 0)) + printSettings.projectRowGap) 
    : TRACK_HEIGHT;

  const getEffPhases = (ex: Exhibition) => {
    if (isPrintMode && !printSettings.showPhases) return [];
    return ex.phases || [];
  };
  const [printGeneratedAt, setPrintGeneratedAt] = useState<Date | null>(null);
  const [collapsedGalleryIds, setCollapsedGalleryIds] = useState<Set<string>>(new Set());
  const toggleGalleryCollapsed = (id: string) => {
    setCollapsedGalleryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const collapseAllGalleries = () => setCollapsedGalleryIds(new Set(galleries.map(g => g.id)));
  const expandAllGalleries = () => setCollapsedGalleryIds(new Set());
  const allCollapsed = galleries.length > 0 && galleries.every(g => collapsedGalleryIds.has(g.id));
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const [draggingBarId, setDraggingBarId] = useState<string | null>(null);
  const dragStartMouseXRef = useRef(0);
  const dragStartProjectXRef = useRef(0);
  const dragDurationDaysRef = useRef(0);
  const [dragTempStartDate, setDragTempStartDate] = useState<string | null>(null);
  const [dragTempEndDate, setDragTempEndDate] = useState<string | null>(null);
  const [draggingMilestone, setDraggingMilestone] = useState<{
    projectId: string;
    checkpointId: string;
    initialMouseX: number;
    initialX: number;
    initialDate: string;
    tempDate: string;
  } | null>(null);

  // Edge-drag resize state stays separate from bar movement so resize starts instantly.
  const [resizingEdge, setResizingEdge] = useState<{ id: string; edge: 'left' | 'right' } | null>(null);
  const resizeInitialMouseXRef = useRef(0);
  const resizeInitialStartDateRef = useRef('');
  const resizeInitialEndDateRef = useRef('');

  // Phase resize (right-edge drag on phase bar updates durationMonths).
  const [resizingPhase, setResizingPhase] = useState<{ projectId: string; phaseId: string } | null>(null);
  const phaseResizeInitialMouseXRef = useRef(0);
  const phaseResizeInitialDurationRef = useRef(0);
  const [phaseResizeTempDuration, setPhaseResizeTempDuration] = useState<number | null>(null);
  const timelineRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timelineRafRef.current) {
        cancelAnimationFrame(timelineRafRef.current);
        timelineRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!quickPopover) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-quick-popover]')) setQuickPopover(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickPopover(null);
    };
    window.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [quickPopover]);

  const viewMonths = useMemo(() => {
    let start = new Date(timelineStartDate + 'T12:00:00');
    let end = new Date(timelineEndDate + 'T12:00:00');
    if (isNaN(start.getTime())) start = new Date();
    if (isNaN(end.getTime())) end = new Date();
    if (start > end) end = start;

    const months = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMarker = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (current <= endMarker) {
      const y = current.getFullYear();
      const m = current.getMonth();
      let fyQ = '';
      if (m >= 3 && m <= 5) fyQ = 'Q1';
      else if (m >= 6 && m <= 8) fyQ = 'Q2';
      else if (m >= 9 && m <= 11) fyQ = 'Q3';
      else fyQ = 'Q4';

      months.push({ year: y, month: m, label: MONTHS[m], fyQuarter: fyQ });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [timelineStartDate, timelineEndDate]);

  // Scale the portfolio shell for the selected paper profile when printing.
  // We measure the TRUE content extent (the inner row uses overflow:hidden and the
  // timeline scroller uses overflow:auto, so the shell's scrollWidth would only
  // report the clipped viewport size — wildly under-reporting actual content).
  useEffect(() => {
    const beforePrint = () => {
      const shell = document.querySelector('[data-print-shell]') as HTMLElement | null;
      if (!shell) return;

      const printHeader = shell.querySelector('[data-print-header]') as HTMLElement | null;
      const prevDisplay = printHeader?.style.display;
      if (printHeader) printHeader.style.display = 'flex';

      const printSidebar = shell.querySelector('[data-print-sidebar]') as HTMLElement | null;
      const timelineScroll = shell.querySelector('[data-print-timeline]') as HTMLElement | null;
      const paper = PRINT_PAGE_SIZES_IN[printSettings.paperSize];
      const pageWidthIn = printSettings.orientation === 'landscape' ? paper.width : paper.height;
      const pageHeightIn = printSettings.orientation === 'landscape' ? paper.height : paper.width;
      const pageWidthPx = (pageWidthIn - (PRINT_MARGIN_IN * 2)) * PRINT_DPI;
      const pageHeightPx = (pageHeightIn - (PRINT_MARGIN_IN * 2)) * PRINT_DPI;

      const result = calculatePrintScale({
        pageWidthPx,
        pageHeightPx,
        sidebarWidthPx: printSidebar?.offsetWidth ?? SIDEBAR_WIDTH,
        sidebarHeightPx: printSidebar?.scrollHeight ?? 0,
        timelineWidthPx: viewMonths.length * monthWidth,
        timelineHeightPx: timelineScroll?.scrollHeight ?? 0,
        headerHeightPx: printHeader?.offsetHeight ?? 0,
        paddingX: PRINT_SHELL_PADDING_X,
        paddingY: PRINT_SHELL_PADDING_Y,
        columnGap: PRINT_COLUMN_GAP,
        minScale: MIN_PRINT_SCALE,
      });

      if (printHeader) printHeader.style.display = prevDisplay || '';
      if (!result.contentWidthPx || !result.contentHeightPx) return;

      shell.style.zoom = String(result.scale);
      shell.dataset.printScale = result.scale.toFixed(2);
      if (printSettings.grayscale) {
        shell.style.filter = 'grayscale(100%) brightness(1.05) contrast(1.1)';
      }
      document.documentElement.style.setProperty('--print-scale', String(result.scale));
      document.documentElement.style.setProperty('--print-font-multiplier', String(printSettings.fontSizeMultiplier));
      document.documentElement.style.setProperty('--print-page-width', `${pageWidthIn}in`);
      document.documentElement.style.setProperty('--print-page-height', `${pageHeightIn}in`);
    };
    const afterPrint = () => {
      const shell = document.querySelector('[data-print-shell]') as HTMLElement | null;
      if (shell) {
        shell.style.zoom = '';
        shell.style.filter = '';
        delete shell.dataset.printScale;
      }
      document.documentElement.style.removeProperty('--print-scale');
      document.documentElement.style.removeProperty('--print-font-multiplier');
      document.documentElement.style.removeProperty('--print-page-width');
      document.documentElement.style.removeProperty('--print-page-height');
      setIsPrintMode(false);
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [SIDEBAR_WIDTH, printSettings, viewMonths.length, monthWidth]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarListRef = useRef<HTMLDivElement>(null);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape' && (draggingBarId || resizingEdge || resizingPhase || draggingMilestone || isDraggingScroll)) {
        e.preventDefault();
        cancelTimelineInteraction();
        return;
      }
      if (e.key === 'Escape') { setSelectedProjectId(null); return; }
      if (isTyping) return;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, draggingBarId, resizingEdge, resizingPhase, draggingMilestone, isDraggingScroll]);

  // Scroll the timeline so todayPos is centred in the viewport.
  const scrollToToday = () => {
    if (!timelineRef.current) return;
    const el = timelineRef.current;
    el.scrollLeft = todayPos - el.clientWidth / 2;
  };


  const applyPreset = (years: number) => {
    if (isNaN(years)) return;
    const d = new Date();
    setTimelineStartDate(`${d.getFullYear()}-01-01`);
    setTimelineEndDate(`${d.getFullYear() + years - 1}-12-31`);

    const presetWidths: Record<number, number> = {
      1: 132,
      2: 88,
      3: 56,
      4: 42,
      5: 32
    };
    setMonthWidth(presetWidths[years] || 56);
  };

  const printGalleryIds = useMemo(() => {
    const ids = printSettings.selectedGalleryIds.length > 0
      ? printSettings.selectedGalleryIds
      : galleries.map(g => g.id);
    return new Set(ids);
  }, [galleries, printSettings.selectedGalleryIds]);

  const portfolioGalleries = useMemo(() => {
    if (!isPrintMode || printSettings.laneBehavior !== 'selected-only') return galleries;
    return galleries.filter(g => printGalleryIds.has(g.id));
  }, [galleries, isPrintMode, printGalleryIds, printSettings.laneBehavior]);

  const effectiveCollapsedGalleryIds = useMemo(() => {
    if (!isPrintMode) return collapsedGalleryIds;
    if (printSettings.laneBehavior === 'current') return collapsedGalleryIds;
    return new Set<string>();
  }, [collapsedGalleryIds, isPrintMode, printSettings.laneBehavior]);

  const effectiveStatuses = useMemo(() => (
    isPrintMode ? new Set(printSettings.statuses) : new Set(ALL_STATUSES)
  ), [isPrintMode, printSettings.statuses]);

  const filteredExhibitions = useMemo(() => {
    const visibleGalleryNames = new Set(portfolioGalleries.map(g => g.name));
    return exhibitions.filter(ex =>
      effectiveStatuses.has(ex.status) &&
      visibleGalleryNames.has(ex.gallery)
    );
  }, [exhibitions, effectiveStatuses, portfolioGalleries]);

  const projectById = useMemo(() => new Map(exhibitions.map(ex => [ex.id, ex])), [exhibitions]);
  const phaseTypeById = useMemo(() => new Map(phaseTypes.map(type => [type.id, type])), [phaseTypes]);
  const filteredProjectsByGallery = useMemo(() => {
    const grouped = new Map<string, Exhibition[]>();
    portfolioGalleries.forEach(gallery => grouped.set(gallery.name, []));
    filteredExhibitions.forEach(ex => {
      const bucket = grouped.get(ex.gallery);
      if (bucket) bucket.push(ex);
    });
    return grouped;
  }, [filteredExhibitions, portfolioGalleries]);

  const galleryHasMilestones = useMemo(() => {
    const result = new Map<string, boolean>();
    portfolioGalleries.forEach(gallery => {
      result.set(gallery.name, (filteredProjectsByGallery.get(gallery.name) || []).some(ex => (ex.checkpoints || []).length > 0));
    });
    return result;
  }, [filteredProjectsByGallery, portfolioGalleries]);

  const galleryMilestoneCounts = useMemo(() => {
    const result = new Map<string, number>();
    portfolioGalleries.forEach(gallery => {
      const count = (filteredProjectsByGallery.get(gallery.name) || []).reduce(
        (sum, ex) => sum + (ex.checkpoints?.length || 0),
        0
      );
      result.set(gallery.name, count);
    });
    return result;
  }, [filteredProjectsByGallery, portfolioGalleries]);

  const printMilestoneRowsFor = (galleryName: string) => {
    const rowCount = Math.max(MIN_PRINT_MILESTONE_ROWS, galleryMilestoneCounts.get(galleryName) || 0);
    return Array.from({ length: rowCount }, (_, index) => PRINT_MILESTONE_ROW_TOP + (index * PRINT_MILESTONE_ROW_GAP));
  };

  const milestoneBandHeightFor = (galleryName: string) => {
    if (!galleryHasMilestones.get(galleryName)) return 0;
    if (!isPrintMode) return SCREEN_MILESTONE_BAND_HEIGHT;
    const rows = printMilestoneRowsFor(galleryName);
    const lastRowTop = rows[rows.length - 1] ?? PRINT_MILESTONE_ROW_TOP;
    return lastRowTop + PRINT_MILESTONE_LABEL_HEIGHT + PRINT_MILESTONE_BAND_PADDING_BOTTOM;
  };

  // ── Conflict detection ─────────────────────────────────────────────────
  // A Set of exhibition IDs that overlap with at least one peer in the same gallery.
  const conflictingIds = useMemo(() => {
    const ids = new Set<string>();
    portfolioGalleries.forEach(gallery => {
      const exs = (filteredProjectsByGallery.get(gallery.name) || []).filter(ex => ex.scheduleMode !== 'single-date');
      for (let i = 0; i < exs.length; i++) {
        for (let j = i + 1; j < exs.length; j++) {
          const a = exs[i], b = exs[j];
          // Overlap: a starts before b ends AND b starts before a ends
          if (a.startDate < b.endDate && b.startDate < a.endDate) {
            ids.add(a.id);
            ids.add(b.id);
          }
        }
      }
    });
    return ids;
  }, [filteredProjectsByGallery, portfolioGalleries]);

  const printProjectCheckpointCount = filteredExhibitions.reduce((sum, ex) => sum + (ex.checkpoints?.length || 0), 0);

  const handleStartPrint = () => {
    flushSync(() => {
      setPrintGeneratedAt(new Date());
      setIsPrintMode(true);
      setShowPrintOptions(false);
    });
    requestAnimationFrame(() => window.print());
  };

  const yearBlocks = useMemo(() => {
    const blocks: {label: number, count: number}[] = [];
    let currentYear = -1;
    let count = 0;
    viewMonths.forEach(m => {
      if (m.year !== currentYear) {
        if (currentYear !== -1) blocks.push({ label: currentYear, count });
        currentYear = m.year;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentYear !== -1) blocks.push({ label: currentYear, count });
    return blocks;
  }, [viewMonths]);

  const fyBlocks = useMemo(() => {
    const blocks: {label: string, count: number}[] = [];
    let currentFY = -1;
    let count = 0;
    viewMonths.forEach(m => {
      const fy = m.month >= 3 ? m.year : m.year - 1;
      if (fy !== currentFY) {
        if (currentFY !== -1) blocks.push({ label: `FY${String(currentFY).slice(2)}/${String(currentFY + 1).slice(2)}`, count });
        currentFY = fy;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentFY !== -1) blocks.push({ label: `FY${String(currentFY).slice(2)}/${String(currentFY + 1).slice(2)}`, count });
    return blocks;
  }, [viewMonths]);

  const fyQuarterBlocks = useMemo(() => {
    const blocks: {label: string, count: number}[] = [];
    let currentQ = '';
    let currentFY = -1;
    let count = 0;
    viewMonths.forEach(m => {
      const fy = m.month >= 3 ? m.year + 1 : m.year;
      const q = m.fyQuarter;
      if (q !== currentQ || fy !== currentFY) {
        if (currentQ !== '') blocks.push({ label: currentQ, count });
        currentQ = q;
        currentFY = fy;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentQ !== '') blocks.push({ label: currentQ, count });
    return blocks;
  }, [viewMonths]);

  const galleryLayouts = useMemo(() => {
    const layouts: { [galleryName: string]: { tracks: { [id: string]: number }, maxTracks: number } } = {};
    portfolioGalleries.forEach(gallery => {
      const galleryProjects = (filteredProjectsByGallery.get(gallery.name) || [])
        .map(ex => ({ ...ex, phases: getEffPhases(ex) }));
      const layoutInfo = calculateTracks(galleryProjects, monthWidth, viewMonths, phaseTypes);
      layouts[gallery.name] = { tracks: layoutInfo.tracks, maxTracks: layoutInfo.maxTracks };
    });
    return layouts;
  }, [filteredProjectsByGallery, portfolioGalleries, monthWidth, viewMonths, phaseTypes, isPrintMode, printSettings.showPhases]);

  const mhFor = (_galleryName: string) => GALLERY_HEADER_HEIGHT;


  const getProjectPhaseRows = (_project: Exhibition) => 1;

  const galleryTrackLayouts = useMemo(() => {
    const out: Record<string, { trackTops: number[]; total: number; trackHeights: number[] }> = {};
    portfolioGalleries.forEach(gallery => {
      const layout = galleryLayouts[gallery.name];
      const maxTracks = layout?.maxTracks || 1;
      const trackTops: number[] = [];
      const trackHeights: number[] = [];
      let acc = 0;
      for (let i = 0; i < maxTracks; i++) {
        trackTops.push(acc);
        const h = currentTrackHeight;
        trackHeights.push(h);
        acc += h;
      }
      out[gallery.name] = { trackTops, total: acc, trackHeights };
    });
    return out;
  }, [portfolioGalleries, galleryLayouts, currentTrackHeight]);


  const galleryLaneHeights = useMemo(() => {
    return portfolioGalleries.reduce((acc, gallery) => {
      if (effectiveCollapsedGalleryIds.has(gallery.id)) {
        acc[gallery.name] = COLLAPSED_LANE_HEIGHT;
        return acc;
      }
      const tracksTotal = galleryTrackLayouts[gallery.name]?.total || currentTrackHeight;
      const topStrip = mhFor(gallery.name);
      const milestoneBandHeight = milestoneBandHeightFor(gallery.name);
      acc[gallery.name] = Math.max(
        BASE_LANE_HEIGHT,
        topStrip + milestoneBandHeight + LANE_TOP_PADDING + tracksTotal + LANE_BOTTOM_PADDING
      );
      return acc;
    }, {} as Record<string, number>);
  }, [portfolioGalleries, galleryTrackLayouts, effectiveCollapsedGalleryIds, isPrintMode, galleryHasMilestones, galleryMilestoneCounts]);

  const totalTimelineWidth = viewMonths.length * monthWidth;

  const todayPos = useMemo(() => {
    return getPositionFromDate(toISODate(new Date()), monthWidth, viewMonths);
  }, [monthWidth, viewMonths]);

  const weeklyPositions = useMemo(() => {
    if (monthWidth < WEEKLY_GRID_THRESHOLD) return [];
    const start = new Date(timelineStartDate + 'T12:00:00');
    const end = new Date(timelineEndDate + 'T12:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    const positions: number[] = [];
    const firstMondayOffset = (8 - (start.getDay() || 7)) % 7;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + firstMondayOffset);
    let safety = 0;
    while (cursor <= end && safety < 600) {
      positions.push(getPositionFromDate(toISODate(cursor), monthWidth, viewMonths));
      cursor.setDate(cursor.getDate() + 7);
      safety += 1;
    }
    return positions;
  }, [timelineStartDate, timelineEndDate, monthWidth, viewMonths]);

  const showWeeklyGrid = monthWidth >= WEEKLY_GRID_THRESHOLD;

  const activeDragFeedback = (draggingBarId || resizingEdge) && dragTempStartDate && dragTempEndDate
    ? {
        startDate: dragTempStartDate,
        endDate: dragTempEndDate,
        startX: getPositionFromDate(dragTempStartDate, monthWidth, viewMonths),
        endX: getPositionFromDate(dragTempEndDate, monthWidth, viewMonths),
        mode: draggingBarId ? 'move' : resizingEdge?.edge === 'left' ? 'start resize' : 'end resize'
      }
    : null;

  const openProjectQuickEdit = (event: React.MouseEvent | React.PointerEvent, project: Exhibition) => {
    event.stopPropagation();
    setQuickPopover({ mode: 'project', projectId: project.id, x: event.clientX, y: event.clientY });
  };

  const openMilestoneQuickEdit = (
    event: React.MouseEvent | React.PointerEvent,
    project: Exhibition,
    date: string,
    checkpointId?: string
  ) => {
    event.stopPropagation();
    setQuickPopover({ mode: 'milestone', projectId: project.id, checkpointId, date, x: event.clientX, y: event.clientY });
  };

  const openQuickAddProject = (event: React.MouseEvent<HTMLElement>, gallery: Gallery) => {
    if (event.button !== 0 || effectiveCollapsedGalleryIds.has(gallery.id)) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const xInTimeline = event.clientX - rect.left;
    const date = getDateFromPosition(xInTimeline, monthWidth, viewMonths);
    setQuickPopover({ mode: 'add-project', galleryName: gallery.name, date, x: event.clientX, y: event.clientY });
  };

  const createQuickProject = (project: Exhibition) => {
    commitHistory();
    setExhibitions(prev => [...prev, project]);
  };

  const scheduleTimelineFrame = (callback: () => void) => {
    if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);
    timelineRafRef.current = requestAnimationFrame(() => {
      timelineRafRef.current = null;
      callback();
    });
  };

  const onBarDragPointerDown = (e: React.PointerEvent, project: Exhibition) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const projectX = getPositionFromDate(project.startDate, monthWidth, viewMonths);
    const durationDays = getDurationDays(project.startDate, project.endDate);
    dragStartMouseXRef.current = e.clientX;
    dragStartProjectXRef.current = projectX;
    dragDurationDaysRef.current = durationDays;
    setIsDraggingScroll(false);
    setDragTempStartDate(project.startDate);
    setDragTempEndDate(project.endDate);
    setDraggingBarId(project.id);
  };

  const onEdgePointerDown = (e: React.PointerEvent, project: Exhibition, edge: 'left' | 'right') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingScroll(false);
    resizeInitialMouseXRef.current = e.clientX;
    resizeInitialStartDateRef.current = project.startDate;
    resizeInitialEndDateRef.current = project.endDate;
    setResizingEdge({ id: project.id, edge });
    setDragTempStartDate(project.startDate);
    setDragTempEndDate(project.endDate);
  };

  const onPhaseHandlePointerDown = (e: React.PointerEvent, projectId: string, phase: ProjectPhase) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingScroll(false);
    phaseResizeInitialMouseXRef.current = e.clientX;
    phaseResizeInitialDurationRef.current = phase.durationMonths;
    setResizingPhase({ projectId, phaseId: phase.id });
    setPhaseResizeTempDuration(phase.durationMonths);
  };

  const onMilestonePointerDown = (e: React.PointerEvent, project: Exhibition, checkpointId: string, date: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingScroll(false);
    setDraggingMilestone({
      projectId: project.id,
      checkpointId,
      initialMouseX: e.clientX,
      initialX: getPositionFromDate(date, monthWidth, viewMonths),
      initialDate: date,
      tempDate: date,
    });
  };

  const commitBarDrag = () => {
    if (draggingBarId && dragTempStartDate && dragTempEndDate) {
      const ex = projectById.get(draggingBarId);
      if (ex && (ex.startDate !== dragTempStartDate || ex.endDate !== dragTempEndDate)) {
        handleUpdateExhibition({
          ...ex,
          startDate: dragTempStartDate,
          endDate: dragTempEndDate
        });
      }
    }
  };

  const commitResize = () => {
    if (resizingEdge && dragTempStartDate && dragTempEndDate) {
      const ex = projectById.get(resizingEdge.id);
      if (ex && (ex.startDate !== dragTempStartDate || ex.endDate !== dragTempEndDate)) {
        handleUpdateExhibition({ ...ex, startDate: dragTempStartDate, endDate: dragTempEndDate });
      }
    }
    setResizingEdge(null);
    if (!draggingBarId) {
      setDragTempStartDate(null);
      setDragTempEndDate(null);
    }
  };

  const commitPhaseResize = () => {
    if (resizingPhase && phaseResizeTempDuration !== null) {
      const ex = projectById.get(resizingPhase.projectId);
      const phase = ex?.phases.find(p => p.id === resizingPhase.phaseId);
      if (ex && phase && phase.durationMonths !== phaseResizeTempDuration) {
        const updated: Exhibition = {
          ...ex,
          phases: ex.phases.map(p => p.id === resizingPhase.phaseId
            ? { ...p, durationMonths: phaseResizeTempDuration }
            : p)
        };
        handleUpdateExhibition(updated);
      }
    }
    setResizingPhase(null);
    setPhaseResizeTempDuration(null);
  };

  const finishTimelineInteraction = () => {
    setIsDraggingScroll(false);
    commitBarDrag();
    if (resizingEdge) commitResize();
    if (resizingPhase) commitPhaseResize();
    if (draggingMilestone) commitMilestoneDrag();
    setDraggingBarId(null);
    setDragTempStartDate(null);
    setDragTempEndDate(null);
  };

  const cancelTimelineInteraction = () => {
    setIsDraggingScroll(false);
    setDraggingBarId(null);
    setResizingEdge(null);
    setResizingPhase(null);
    setDraggingMilestone(null);
    setDragTempStartDate(null);
    setDragTempEndDate(null);
    setPhaseResizeTempDuration(null);
  };

  const commitMilestoneDrag = () => {
    if (draggingMilestone) {
      const ex = projectById.get(draggingMilestone.projectId);
      if (ex && draggingMilestone.tempDate !== draggingMilestone.initialDate) {
        handleUpdateExhibition({
          ...ex,
          checkpoints: (ex.checkpoints || []).map(checkpoint =>
            checkpoint.id === draggingMilestone.checkpointId
              ? { ...checkpoint, date: draggingMilestone.tempDate }
              : checkpoint
          )
        });
      }
    }
    setDraggingMilestone(null);
  };

  return (
    <div
      className={`min-h-screen bg-slate-100 print:bg-none print:bg-white text-slate-900 flex flex-col font-sans overflow-hidden select-none antialiased ${draggingBarId || draggingMilestone ? 'cursor-grabbing' : ''}`}
      style={{ fontFeatureSettings: "'cv11','ss01','ss03'" }}
    >
      {showGithubAuth && <div className="no-print"><GithubAuthModal onClose={() => setShowGithubAuth(false)} /></div>}
      {showPrintOptions && (
        <div className="fixed inset-0 bg-slate-900/45 z-[150] backdrop-blur-sm flex items-center justify-center p-4 no-print" onClick={() => setShowPrintOptions(false)}>
          <div className="bg-white border border-slate-200 w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-slate-700" />
                <div>
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-900">Print options</h2>
                </div>
              </div>
              <button aria-label="Close print options" onClick={() => setShowPrintOptions(false)} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-50">
                <X size={15} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4 max-h-[72vh] overflow-y-auto custom-scrollbar">
              <section className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Paper</span>
                    <select
                      value={printSettings.paperSize}
                      onChange={(e) => setPrintSettings(prev => ({ ...prev, paperSize: e.target.value as PrintSettings['paperSize'] }))}
                      className="w-full border border-slate-200 px-2 py-2 text-[11px] bg-white"
                    >
                      <option value="ledger">Ledger 11×17</option>
                      <option value="letter">Letter 8.5×11</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Orientation</span>
                    <select
                      value={printSettings.orientation}
                      onChange={(e) => setPrintSettings(prev => ({ ...prev, orientation: e.target.value as PrintSettings['orientation'] }))}
                      className="w-full border border-slate-200 px-2 py-2 text-[11px] bg-white"
                    >
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-1 block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Lane behaviour</span>
                  <select
                    value={printSettings.laneBehavior}
                    onChange={(e) => setPrintSettings(prev => ({ ...prev, laneBehavior: e.target.value as PrintSettings['laneBehavior'] }))}
                    className="w-full border border-slate-200 px-2 py-2 text-[11px] bg-white"
                  >
                    <option value="current">Use current collapsed state</option>
                    <option value="expand-all">Expand all lanes for print</option>
                    <option value="selected-only">Print only selected lanes</option>
                  </select>
                </label>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Statuses</label>
                    <button
                      type="button"
                      onClick={() => setPrintSettings(prev => ({ ...prev, statuses: prev.statuses.length === ALL_STATUSES.length ? [] : ALL_STATUSES }))}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-900"
                    >
                      {printSettings.statuses.length === ALL_STATUSES.length ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {ALL_STATUSES.map(status => {
                      const checked = printSettings.statuses.includes(status);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setPrintSettings(prev => ({
                            ...prev,
                            statuses: checked ? prev.statuses.filter(s => s !== status) : [...prev.statuses, status],
                          }))}
                          className={`flex items-center gap-2 border px-2 py-2 text-[11px] ${checked ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'}`}
                        >
                          <span className="w-2 h-2" style={{ background: checked ? getStatusStyles(status).barBg : '#cbd5e1' }} />
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900 leading-snug">
                  If the timeline needs to print below {Math.round(MIN_READABLE_PRINT_SCALE * 100)}% scale, shorten the date range or choose fewer lanes for a larger print.
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Selected lanes</label>
                    <button
                      type="button"
                      onClick={() => setPrintSettings(prev => ({ ...prev, selectedGalleryIds: prev.selectedGalleryIds.length === galleries.length ? [] : galleries.map(g => g.id) }))}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-900"
                    >
                      {printSettings.selectedGalleryIds.length === galleries.length ? 'Use all' : 'Select all'}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {galleries.map(gallery => {
                      const checked = printSettings.selectedGalleryIds.length === 0 || printSettings.selectedGalleryIds.includes(gallery.id);
                      const isPermanent = gallery.kind === 'permanent';
                      return (
                        <label key={gallery.id} className={`flex items-center gap-2 border px-2 py-1.5 text-[11px] ${checked ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setPrintSettings(prev => {
                              const current = prev.selectedGalleryIds.length === 0 ? galleries.map(g => g.id) : prev.selectedGalleryIds;
                              const selectedGalleryIds = current.includes(gallery.id)
                                ? current.filter(id => id !== gallery.id)
                                : [...current, gallery.id];
                              return { ...prev, selectedGalleryIds };
                            })}
                          />
                          <span className={`w-1 h-3 shrink-0 ${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}`} />
                          <span className="truncate flex-1" title={gallery.name}>{gallery.name}</span>
                          {isPermanent && <Star size={9} className="shrink-0 text-amber-600 fill-amber-600" strokeWidth={1.5} />}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">Showing all {galleries.length} lane{galleries.length === 1 ? '' : 's'}. Selections apply when lane behaviour is “Print only selected lanes”.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 border border-slate-200 px-2 py-2 text-[11px] text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={printSettings.includeSummary}
                      onChange={(e) => setPrintSettings(prev => ({ ...prev, includeSummary: e.target.checked }))}
                    />
                    Phase Log & Inventory
                  </label>
                  <label className="flex items-center gap-2 border border-slate-200 px-2 py-2 text-[11px] text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={printSettings.includeLegends}
                      onChange={(e) => setPrintSettings(prev => ({ ...prev, includeLegends: e.target.checked }))}
                    />
                    Project status key
                  </label>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 block mb-2">Visual appearance</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 border border-slate-200 px-2 py-2 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={printSettings.showPhases}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, showPhases: e.target.checked }))}
                      />
                      Show project phases
                    </label>
                    <label className="flex items-center gap-2 border border-slate-200 px-2 py-2 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={printSettings.showDescription}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, showDescription: e.target.checked }))}
                      />
                      Show descriptions
                    </label>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 block">Font scale</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="0.75" 
                        max="1.5" 
                        step="0.05"
                        value={printSettings.fontSizeMultiplier}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, fontSizeMultiplier: parseFloat(e.target.value) }))}
                        className="flex-1 accent-slate-900"
                      />
                      <span className="text-[11px] font-mono w-10 text-right">{Math.round(printSettings.fontSizeMultiplier * 100)}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 block">Row vertical gap</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="0" 
                        max="60" 
                        step="2"
                        value={printSettings.projectRowGap}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, projectRowGap: parseInt(e.target.value) }))}
                        className="flex-1 accent-slate-900"
                      />
                      <span className="text-[11px] font-mono w-10 text-right">{printSettings.projectRowGap}px</span>
                    </div>
                  </div>
                  
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Footer Note</span>
                    <input
                      type="text"
                      maxLength={140}
                      placeholder="e.g. For internal review only..."
                      value={printSettings.footerNote}
                      onChange={(e) => setPrintSettings(prev => ({ ...prev, footerNote: e.target.value }))}
                      className="w-full border border-slate-200 px-2 py-2 text-[11px] bg-white placeholder:text-slate-300"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="text-[10px] text-slate-500">
                {printSettings.statuses.length} status filter{printSettings.statuses.length === 1 ? '' : 's'} · {printSettings.laneBehavior === 'selected-only' ? `${printGalleryIds.size} selected lane${printGalleryIds.size === 1 ? '' : 's'}` : printSettings.laneBehavior.replace('-', ' ')}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPrintOptions(false)} className="px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-white border border-slate-200">Cancel</button>
                <button onClick={handleStartPrint} className="px-3 py-2 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5">
                  <Printer size={12} /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .is-grabbing { cursor: grabbing !important; }

        .timeline-container { outline: none; }

        input[type="range"] {
          -webkit-appearance: none;
          background: #e2e8f0;
          height: 2px;
          border-radius: 0;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          background: #0f172a;
          border-radius: 0;
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 1.5px solid #0f172a;
          outline-offset: 1px;
        }

        .project-bar-dragging {
          opacity: 0.7 !important;
          z-index: 100 !important;
          cursor: grabbing !important;
          box-shadow: 0 4px 10px rgba(15,23,42,0.18) !important;
          transform: translateY(-1px) !important;
        }

        .gallery-lane-bg {
          background-color: transparent;
          transition: background-color 0.15s ease;
        }
        .gallery-lane-bg:hover {
          background-color: rgba(241,245,249,0.6);
        }

        kbd.app-kbd {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 16px; height: 16px; padding: 0 4px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10px; color: #475569;
          background: #f8fafc; border: 1px solid #e2e8f0; border-bottom-width: 1.5px;
          border-radius: 3px; line-height: 1;
        }
      `}</style>
      

      {(() => {
        const selectedExhibition = selectedProjectId
          ? projectById.get(selectedProjectId)
          : null;
        if (!selectedExhibition) return null;
        return (
          <>
            <div
              className="fixed inset-0 bg-slate-900/40 z-[145] no-print backdrop-blur-[2px] pointer-events-none"
              aria-hidden="true"
            />
            <DetailPanel
              exhibition={selectedExhibition}
              onClose={() => setSelectedProjectId(null)}
              onUpdate={handleUpdateExhibition}
              onDelete={(id) => {
                const before = useStore.getState().exhibitions.length;
                handleRemoveExhibition(id);
                if (useStore.getState().exhibitions.length < before) {
                  setSelectedProjectId(null);
                }
              }}
              onDuplicate={handleDuplicateProject}
              galleries={galleries}
              phaseTypes={phaseTypes}
            />
          </>
        );
      })()}

      {quickPopover?.mode === 'project' && (() => {
        const project = projectById.get(quickPopover.projectId);
        if (!project) return null;
        return (
          <QuickProjectPopover
            project={project}
            galleries={galleries}
            anchor={{ x: quickPopover.x, y: quickPopover.y }}
            onUpdate={handleUpdateExhibition}
            onClose={() => setQuickPopover(null)}
            onOpenMilestone={(date) => setQuickPopover({
              mode: 'milestone',
              projectId: project.id,
              date,
              x: quickPopover.x + 20,
              y: quickPopover.y + 20,
            })}
          />
        );
      })()}

      {quickPopover?.mode === 'add-project' && (
        <QuickAddProjectPopover
          anchor={{ x: quickPopover.x, y: quickPopover.y }}
          galleryName={quickPopover.galleryName}
          date={quickPopover.date}
          phaseTypes={phaseTypes}
          onCreate={createQuickProject}
          onClose={() => setQuickPopover(null)}
        />
      )}

      {quickPopover?.mode === 'milestone' && (() => {
        const project = projectById.get(quickPopover.projectId);
        const checkpoint = project?.checkpoints?.find(item => item.id === quickPopover.checkpointId);
        if (!project) return null;
        return (
          <QuickMilestonePopover
            project={project}
            checkpoint={checkpoint}
            date={quickPopover.date}
            anchor={{ x: quickPopover.x, y: quickPopover.y }}
            onUpdate={handleUpdateExhibition}
            onClose={() => setQuickPopover(null)}
          />
        );
      })()}

      <main className="flex-1 flex flex-col min-w-0 pb-6 print:pb-0">
        {activeTab === 'portfolio' ? (
          <>
            <header className="bg-white border-b border-slate-200 z-50 shrink-0 print:hidden">
              <nav className="px-3 flex items-center justify-between gap-3" style={{ height: '40px' }}>
                {/* Left: brand + breadcrumb */}
                <div className="flex items-center gap-2 min-w-0 shrink-0">
                  <div className="w-5 h-5 bg-slate-900 flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold leading-none">{(museumName || 'R').trim().charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-[12px] font-medium text-slate-900 truncate max-w-[220px]" title={museumName}>{museumName}</span>
                  <span className="text-slate-300 text-[11px]">/</span>
                  <span className="text-[11px] text-slate-600">Exhibition Plan</span>
                </div>

                {/* Center: range + zoom */}
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
                  {/* Date range */}
                  <div className="flex items-center gap-1.5 border border-slate-200 px-2 leading-none h-7 shrink-0">
                    <Calendar size={11} className="text-slate-400 shrink-0" />
                    <input
                      aria-label="Start date"
                      type="date"
                      value={timelineStartDate}
                      onChange={(e) => setTimelineStartDate(e.target.value)}
                      className="bg-transparent text-[11px] outline-none w-[100px]"
                    />
                    <span className="text-slate-300 text-[11px]">–</span>
                    <input
                      aria-label="End date"
                      type="date"
                      value={timelineEndDate}
                      onChange={(e) => setTimelineEndDate(e.target.value)}
                      className="bg-transparent text-[11px] outline-none w-[100px]"
                    />
                  </div>

                  <div className="w-px h-4 bg-slate-200 shrink-0" />

                  {/* Year presets */}
                  <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Timeline span presets">
                    {[1, 2, 3, 4, 5].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => applyPreset(y)}
                        className="text-[11px] px-1.5 py-1 leading-none text-slate-600 hover:bg-slate-50 transition-colors"
                        title={`${y}-year view`}
                      >
                        {y}Y
                      </button>
                    ))}
                  </div>

                </div>

                {/* Right: sync + actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {currentUser ? (
                    <button
                      onClick={() => {
                        if (window.confirm('Sign out?')) {
                          localStorage.removeItem('github_pat');
                          localStorage.removeItem('github_gist_id');
                          window.location.reload();
                        }
                      }}
                      className="flex items-center gap-1.5 px-1.5 py-1 text-slate-500 hover:bg-slate-50 leading-none transition-colors"
                      title={`${currentUser.displayName || currentUser.email || 'Signed in'} — click to sign out`}
                    >
                      <Cloud size={12} />
                      <span className="text-[11px]">{syncStatus === 'syncing' ? 'Syncing…' : syncLabel}</span>
                      {(syncStatus === 'syncing' || syncStatus === 'error') && (
                        <span className={`w-1.5 h-1.5 rounded-full ${syncDotClass} ml-0.5`} />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowGithubAuth(true)}
                      className="flex items-center gap-1.5 px-1.5 py-1 text-slate-500 hover:bg-slate-50 leading-none transition-colors"
                      title="Set up GitHub sync"
                    >
                      <CloudOff size={12} />
                      <span className="text-[11px]">Sync</span>
                    </button>
                  )}

                  <div className="w-px h-4 bg-slate-200 mx-0.5" />

                  <button
                    onClick={undo}
                    disabled={historyPast.length === 0}
                    className="p-1 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Undo"
                    aria-label="Undo"
                  >
                    <Undo size={12} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyFuture.length === 0}
                    className="p-1 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Redo"
                    aria-label="Redo"
                  >
                    <Redo size={12} />
                  </button>

                  <button
                    onClick={() => exportExhibitionsToCSV(exhibitions, phaseTypes)}
                    className="p-1 text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Export as CSV"
                    aria-label="Export as CSV"
                  >
                    <Download size={12} />
                  </button>

                  <div className="w-px h-4 bg-slate-200 mx-0.5" />

                  <button
                    onClick={() => allCollapsed ? expandAllGalleries() : collapseAllGalleries()}
                    disabled={galleries.length === 0}
                    className="p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={allCollapsed ? 'Expand all lanes' : 'Collapse all lanes'}
                    aria-label={allCollapsed ? 'Expand all lanes' : 'Collapse all lanes'}
                  >
                    {allCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </button>
                  <button
                    onClick={() => setShowPrintOptions(true)}
                    className="p-1 text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Print options"
                    aria-label="Print"
                  >
                    <Printer size={12} />
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="p-1 text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Settings"
                    aria-label="Settings"
                  >
                    <Settings size={12} />
                  </button>
                  <button
                    disabled={galleries.length === 0}
                    onClick={() => {
                      const defaultGallery = galleries[0];
                      if (!defaultGallery) {
                        window.alert('Add a location in Settings before creating a project.');
                        return;
                      }
                      const id = Math.random().toString(36).slice(2, 11);
                      const now = new Date();
                      const exStart = getDateWithMonthDuration(toISODate(now), 12);
                      const exEnd = getDateWithMonthDuration(exStart, 3);
                      const scheduleMode: Exhibition['scheduleMode'] = defaultGallery.kind === 'permanent' ? 'single-date' : 'range';
                      const newEx: Exhibition = {
                        id, exhibitionId: '', title: 'NEW PROJECT', status: 'TBC',
                        startDate: exStart, endDate: scheduleMode === 'single-date' ? exStart : exEnd, gallery: defaultGallery.name,
                        scheduleMode, checkpoints: [], phases: phaseTypes.map(pt => ({
                          id: Math.random().toString(36).slice(2, 11), label: pt.label,
                          durationMonths: pt.isPost ? 1 : 3, typeId: pt.id
                        })), description: '',
                      };
                      commitHistory();
                      setExhibitions([...exhibitions, newEx]);
                      setSelectedProjectId(id);
                    }}
                    className="ml-1 px-2 py-1 bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title="New project"
                  >
                    <Plus size={11} strokeWidth={2.5} />
                    <span>New project</span>
                  </button>
                </div>
              </nav>
            </header>

            <div data-print-shell className="flex-1 flex flex-col overflow-hidden">
              <div data-print-header className="hidden print:flex flex-col gap-1 px-3 py-2 border-b border-slate-300 bg-white shrink-0">
                <div className="flex justify-between items-baseline gap-4">
                  <h1 className="text-base font-bold uppercase tracking-[0.18em] text-slate-900">{museumName} — Exhibition Plan</h1>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700">
                    {timelineStartDate} to {timelineEndDate} · Printed {formatPrintDateTime(printGeneratedAt)}
                  </span>
                </div>
                {printSettings.includeSummary && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-700">
                    {ALL_STATUSES.map(status => (
                      <span key={status} className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5" style={{ background: getStatusStyles(status).barBg }} />
                        {status}: {filteredExhibitions.filter(ex => ex.status === status).length}
                      </span>
                    ))}
                    <span>Project milestones: {printProjectCheckpointCount}</span>
                  </div>
                )}
                {printSettings.includeLegends && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] text-slate-600" data-print-status-key>
                    <span className="font-semibold uppercase tracking-[0.08em] text-slate-700">Project status</span>
                    {ALL_STATUSES.map(status => {
                      const statusStyle = getStatusStyles(status);
                      return (
                        <span key={status} className="inline-flex items-center gap-1.5">
                          <span className="w-3 h-1.5 border border-slate-400" style={{ background: statusStyle.barBg }} />
                          {status}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div
                className="flex-1 overflow-auto timeline-root custom-scrollbar no-print-bg pr-3 pb-3 print:overflow-visible relative"
                ref={timelineRef}
              >
                <div className="flex min-w-max h-max print:flex relative pt-2 pl-3">
                  <aside 
                    data-print-sidebar 
                    className="sticky left-0 bg-white flex flex-col shrink-0 z-[120] border-r border-slate-200 shadow-sm isolate overflow-hidden -ml-3" 
                    style={{ width: `${SIDEBAR_WIDTH}px` }}
                  >
                    <div style={{ height: `${HEADER_HEIGHT}px` }} className="sticky top-0 z-[110] shrink-0 bg-white border-b border-slate-200 flex flex-col print:bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                      <div className="flex h-[22px] border-b border-slate-200 bg-white px-3 items-center">
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-[0.1em]">Timeline</span>
                      </div>
                      <div className="flex h-[16px] border-b border-slate-200 bg-slate-50 px-3 items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.08em]">Fiscal Year</span>
                      </div>
                      <div className="flex h-[16px] border-b border-slate-200 bg-slate-50 px-3 items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.08em]">Quarter</span>
                      </div>
                      <div className="flex h-[16px] bg-white px-3 items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.08em]">Month</span>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 bg-white relative z-10 print:pt-2" ref={sidebarListRef}>
                  {portfolioGalleries.map((gallery) => {
                    const laneHeight = galleryLaneHeights[gallery.name] || BASE_LANE_HEIGHT;
                    const galleryProjects = filteredProjectsByGallery.get(gallery.name) || [];
                    const isPermanent = gallery.kind === 'permanent';
                    const isCollapsed = effectiveCollapsedGalleryIds.has(gallery.id);
                    // Keep the gallery header and project tracks aligned across the
                    // sidebar and the timeline.
                    const headerHeight = mhFor(gallery.name);
                    if (isCollapsed) {
                      return (
	                        <div
	                          key={gallery.id}
	                          style={{ height: `${laneHeight}px` }}
	                          className="relative border-b-2 border-slate-300 overflow-hidden flex items-center pl-4 pr-2.5 gap-1.5 bg-slate-50 print:bg-white"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-slate-500" />
                          <button
                            type="button"
                            aria-label={`Expand ${gallery.name}`}
                            onClick={() => toggleGalleryCollapsed(gallery.id)}
                            className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors no-print"
                          >
                            <ChevronRight size={12} strokeWidth={2.25} />
                          </button>
	                          <span className="font-bold text-[12px] text-slate-900 truncate flex-1 uppercase tracking-[0.03em] leading-tight" title={gallery.name}>{gallery.name}</span>
                          {isPermanent && (
                            <Star size={11} className="shrink-0 text-slate-600 fill-slate-600" strokeWidth={1.5} aria-label="Permanent gallery" />
                          )}
                          <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500 px-1.5 py-0.5 bg-white border border-slate-200">{galleryProjects.length}</span>
                        </div>
                      );
                    }
                    return (
	                      <div key={gallery.id} style={{ height: `${laneHeight}px` }} className="relative border-b-2 border-slate-300 overflow-hidden bg-white">
	                        <div className="absolute left-0 top-0 bottom-0 w-[3px] z-10 bg-slate-500" />
	                        <div
	                          style={{ height: `${headerHeight}px` }}
	                          className="absolute top-0 left-0 w-full border-b-2 flex items-center gap-2 pl-4 pr-2.5 z-20 bg-slate-100 border-slate-300 print:bg-white print:border-slate-300"
	                          title={isPermanent ? 'Permanent gallery' : 'Temporary exhibition space'}
	                        >
                          <button
                            type="button"
                            aria-label={`Collapse ${gallery.name}`}
                            onClick={() => toggleGalleryCollapsed(gallery.id)}
                            className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors no-print"
                          >
                            <ChevronDown size={12} strokeWidth={2.25} />
                          </button>
	                          <span className="font-bold text-[12px] text-slate-950 flex-1 uppercase tracking-[0.03em] leading-[1.05] whitespace-normal break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]" title={gallery.name}>{gallery.name}</span>
	                          <div className="shrink-0 flex items-center gap-1">
	                            {isPermanent && (
	                              <Star size={11} className="shrink-0 text-slate-600 fill-slate-600" strokeWidth={1.5} aria-label="Permanent gallery" />
	                            )}
	                            <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-600 px-1.5 py-0.5 bg-white border border-slate-200 leading-none">{galleryProjects.length}</span>
	                          </div>
	                        </div>
                        {galleryProjects.map(ex => {
                          const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                          if (trackIndex === undefined) return null;
                          const layout = galleryTrackLayouts[gallery.name];
                          const trackTops = layout?.trackTops ?? [];
                          const trackTop = trackTops[trackIndex] ?? trackIndex * currentTrackHeight;
                          const milestoneBandHeight = milestoneBandHeightFor(gallery.name);
                          // Projects now own a single visual row; phase context is rendered as
                          // quiet tinting around the bar rather than separate phase tracks.
                          const lastTrackIdx = Math.min(trackIndex + getProjectPhaseRows(ex) - 1, Math.max(0, trackTops.length - 1));
                          const lastTrackTop = trackTops[lastTrackIdx] ?? trackTop;
                          // Mirror the timeline's project-bar Y offset: top strip +
                          // lane padding + track top. Without mhFor() the sidebar title
                          // floats above the timeline bar by ~28-48px.
                          const topPos = mhFor(gallery.name) + milestoneBandHeight + LANE_TOP_PADDING + lastTrackTop;
	                          const s = getStatusStyles(ex.status);
	                          const shortStatus = ex.status === 'Open to Public' ? 'OPEN' : 
	                            ex.status === 'In Development' ? 'DEV' : 
	                            ex.status === 'TBC' ? 'TBC' : 'CLOSE';
	                          return (
	                            <div
	                              key={`title-${ex.id}`}
	                              className="absolute flex items-center overflow-hidden"
	                              style={{ 
	                                top: topPos, 
	                                height: `${currentTrackHeight}px`, 
	                                left: '12px', 
	                                right: '10px' 
	                              }}
	                            >
	                              <div className="flex flex-col justify-center min-w-0 w-full gap-px py-0.5">
	                                <span 
	                                  className="text-[10px] font-semibold text-slate-950 leading-[10.5px] overflow-hidden break-words [display:-webkit-box] [-webkit-box-orient:vertical]"
	                                  style={{ WebkitLineClamp: isPrintMode ? 3 : 2 }}
	                                  title={ex.title}
	                                >
	                                  {ex.title}
	                                </span>
	                                <div className="flex items-center gap-1.5 min-w-0 text-[7px] leading-[9px]">
	                                  <span
	                                    className="shrink-0 font-bold px-1 py-0 rounded-[2px] uppercase tracking-tighter border font-mono leading-[9px]"
	                                    style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
	                                  >
	                                    {shortStatus}
	                                  </span>
	                                  {ex.exhibitionId && (
	                                    <span
	                                      className="min-w-0 truncate font-mono text-slate-500"
	                                      title={ex.exhibitionId}
	                                    >
	                                      {ex.exhibitionId}
	                                    </span>
	                                  )}
	                                </div>
	                                {isPrintMode && printSettings.showDescription && ex.description && (
	                                  <span className="text-[9px] text-slate-600 italic truncate leading-tight mt-0.5" title={ex.description}>
	                                    {ex.description}
	                                  </span>
	                                )}
	                              </div>
	                            </div>
	                          );
	                        })}
                        {galleryProjects.map(ex => {
                          const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                          if (trackIndex === undefined || trackIndex === 0) return null;
                          const trackTop = galleryTrackLayouts[gallery.name]?.trackTops[trackIndex] ?? trackIndex * currentTrackHeight;
                          const milestoneBandHeight = milestoneBandHeightFor(gallery.name);
                          return (
	                            <div key={`side-div-${ex.id}`} className="absolute w-full border-t border-slate-100 left-0" style={{ top: mhFor(gallery.name) + milestoneBandHeight + LANE_TOP_PADDING + trackTop }} />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </aside>
              
              <main
                data-print-timeline
                className={`flex-1 flex flex-col relative cursor-grab active:cursor-grabbing ${isDraggingScroll || draggingMilestone ? '!cursor-grabbing' : ''}`} 
                onPointerDown={(e) => {
                  if (e.button === 0 && !draggingBarId && !draggingMilestone && !resizingEdge && !resizingPhase) {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setIsDraggingScroll(true);
                    startXRef.current = e.pageX - timelineRef.current!.offsetLeft;
                    scrollLeftRef.current = timelineRef.current!.scrollLeft;
                  }
                }}
                onPointerUp={finishTimelineInteraction}
                onPointerCancel={cancelTimelineInteraction}
                onPointerMove={(e) => {
                  if (resizingEdge) {
                    const deltaX = e.clientX - resizeInitialMouseXRef.current;
                    const dayPxRatio = (365.25 / 12) / monthWidth; // days per pixel
                    const deltaDays = Math.round(deltaX * dayPxRatio);
                    if (resizingEdge.edge === 'left') {
                      const initStart = new Date(resizeInitialStartDateRef.current + 'T12:00:00');
                      const initEnd = new Date(resizeInitialEndDateRef.current + 'T12:00:00');
                      const newStart = new Date(initStart);
                      newStart.setDate(newStart.getDate() + deltaDays);
                      // Don't allow start to cross end (keep at least 1 day duration).
                      const minEnd = new Date(initEnd);
                      minEnd.setDate(minEnd.getDate() - 1);
                      if (newStart > minEnd) return;
                      let iso = toISODate(newStart);
                      if (showWeeklyGrid && !e.altKey) iso = snapDate(iso, 'week');
                      scheduleTimelineFrame(() => {
                        setDragTempStartDate(iso);
                        setDragTempEndDate(resizeInitialEndDateRef.current);
                      });
                    } else {
                      const initStart = new Date(resizeInitialStartDateRef.current + 'T12:00:00');
                      const initEnd = new Date(resizeInitialEndDateRef.current + 'T12:00:00');
                      const newEnd = new Date(initEnd);
                      newEnd.setDate(newEnd.getDate() + deltaDays);
                      const minStart = new Date(initStart);
                      minStart.setDate(minStart.getDate() + 1);
                      if (newEnd < minStart) return;
                      let iso = toISODate(newEnd);
                      if (showWeeklyGrid && !e.altKey) iso = snapDate(iso, 'week');
                      scheduleTimelineFrame(() => {
                        setDragTempStartDate(resizeInitialStartDateRef.current);
                        setDragTempEndDate(iso);
                      });
                    }
                    return;
                  }

                  if (resizingPhase) {
                    const deltaX = e.clientX - phaseResizeInitialMouseXRef.current;
                    const deltaMonths = deltaX / monthWidth;
                    // Snap to quarter-month (~weekly) granularity.
                    const raw = phaseResizeInitialDurationRef.current + deltaMonths;
                    const snapped = Math.max(0.25, Math.round(raw * 4) / 4);
                    scheduleTimelineFrame(() => setPhaseResizeTempDuration(snapped));
                    return;
                  }

                  if (draggingMilestone) {
                    const deltaX = e.clientX - draggingMilestone.initialMouseX;
                    let nextDate = getDateFromPosition(draggingMilestone.initialX + deltaX, monthWidth, viewMonths);
                    if (showWeeklyGrid && !e.altKey) nextDate = snapDate(nextDate, 'week');
                    scheduleTimelineFrame(() => setDraggingMilestone(prev => prev ? { ...prev, tempDate: nextDate } : null));
                    return;
                  }

	                  if (draggingBarId) {
	                    const deltaX = e.clientX - dragStartMouseXRef.current;
	                    const newProjectX = dragStartProjectXRef.current + deltaX;
	                    let newStartDate = getDateFromPosition(newProjectX, monthWidth, viewMonths);
	                    if (showWeeklyGrid && !e.altKey) newStartDate = snapDate(newStartDate, 'week');
	                    const start = new Date(newStartDate + 'T12:00:00');
	                    const draggedEnd = new Date(start);
	                    draggedEnd.setDate(draggedEnd.getDate() + dragDurationDaysRef.current);
	                    const newEndDate = toISODate(draggedEnd);

                    scheduleTimelineFrame(() => {
                      setDragTempStartDate(newStartDate);
                      setDragTempEndDate(newEndDate);
                    });
                    return;
                  }

                  if (!isDraggingScroll || !timelineRef.current) return;
                  const x = e.pageX - timelineRef.current.offsetLeft;
                  timelineRef.current.scrollLeft = scrollLeftRef.current - (x - startXRef.current) * 1.5;
	                }}
	              >
	                <div className="inline-flex flex-col relative min-h-full">
	                  {/* Now Indicator */}
                  <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-[70] pointer-events-none" style={{ left: `${todayPos}px` }}>
                    <div className="sticky top-[6px] bg-red-600 text-white font-semibold text-[10px] px-1.5 py-0.5 uppercase transform -translate-x-1/2 shadow-sm w-max whitespace-nowrap">TODAY</div>
                  </div>

                  {activeDragFeedback && (
                    <div className="absolute top-0 bottom-0 z-[75] pointer-events-none no-print" style={{ width: `${totalTimelineWidth}px` }}>
                      {/* Original Position Ghost */}
                      <div
                        className="absolute h-full border-l border-dashed border-slate-300 opacity-25"
                        style={{ left: `${getPositionFromDate(resizeInitialStartDateRef.current || dragStartProjectXRef.current ? dragTempStartDate || '' : '', monthWidth, viewMonths)}px` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-blue-600 shadow-[0_0_0_1px_rgba(255,255,255,0.85),0_0_18px_rgba(37,99,235,0.38)]"
                        style={{ left: `${activeDragFeedback.startX}px` }}
                      >
                        <div className="sticky top-[70px] -translate-x-1/2 rounded-sm border border-blue-700 bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-lg whitespace-nowrap">
                          {activeDragFeedback.mode === 'end resize' ? 'Start stays' : 'Start'} {formatBarDate(activeDragFeedback.startDate)}
                        </div>
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-blue-600/80 border-l border-dashed border-white/80 shadow-[0_0_14px_rgba(37,99,235,0.25)]"
                        style={{ left: `${activeDragFeedback.endX}px` }}
                      >
                        <div className="sticky top-[102px] -translate-x-1/2 rounded-sm border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-lg whitespace-nowrap">
                          {activeDragFeedback.mode === 'start resize' ? 'End stays' : 'End'} {formatBarDate(activeDragFeedback.endDate)}
                        </div>
                      </div>
                      <div
                        className="absolute top-[62px] h-[calc(100%-62px)] border-x-2 border-blue-500/45 bg-blue-500/10"
                        style={{
                          left: `${Math.min(activeDragFeedback.startX, activeDragFeedback.endX)}px`,
                          width: `${Math.max(8, Math.abs(activeDragFeedback.endX - activeDragFeedback.startX))}px`
                        }}
                      />
                      <div
                        className="sticky top-[6px] inline-flex items-center gap-2 rounded-sm border border-blue-200 bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-900 shadow-lg backdrop-blur"
                        style={{ marginLeft: `${Math.max(8, Math.min(activeDragFeedback.startX, totalTimelineWidth - 260))}px` }}
                      >
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                        {activeDragFeedback.mode}: {formatBarDate(activeDragFeedback.startDate)}–{formatBarDate(activeDragFeedback.endDate)}
                        <span className="text-slate-400">Alt = unsnapped</span>
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="sticky top-0 z-[60] border-b border-slate-200 flex flex-col overflow-hidden bg-white" style={{ height: `${HEADER_HEIGHT}px` }}>
                    <div className="flex h-[22px] border-b border-slate-200 bg-white relative z-10 print:bg-white print:border-slate-400">
                      {yearBlocks.map(block => <div key={block.label} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center px-3 font-bold text-[12px] tracking-[0.06em] text-slate-950 border-r border-slate-200 print:border-slate-400 print:text-black">{block.label}</div>)}
                    </div>
                     <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/60 relative z-10 print:bg-orange-50 print:border-orange-300">
                       {fyBlocks.map((block) => (
                         <div key={block.label} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center justify-start px-3 font-bold text-[10px] uppercase tracking-[0.08em] border-r border-slate-200 text-slate-800 print:text-orange-900">{block.label}</div>
                       ))}
                     </div>
                    <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/40 relative z-10 print:bg-slate-50 text-slate-700">
                      {fyQuarterBlocks.map((block, i) => <div key={`${block.label}-${i}`} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-200 text-[10px] font-bold tracking-[0.06em] text-slate-700 print:text-slate-900">{block.label}</div>)}
                    </div>
                    <div className="flex h-[16px] bg-white relative z-10 print:bg-white text-slate-600">
                      {viewMonths.map(m => <div key={`${m.year}-${m.month}`} style={{ width: `${monthWidth}px` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-200 text-[10px] font-semibold tracking-[0.04em] text-slate-700 print:text-slate-900">{m.label}</div>)}
                    </div>
                  </div>

                  {/* Grid Lines (Monthly & Fiscal) */}
                  <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-[10]">
                    {/* Weekly Dividers (rendered first so monthly/fiscal sit on top) */}
                    {showWeeklyGrid && weeklyPositions.map((pos, idx) => (
                      <div
                        key={`week-${idx}`}
                        style={{ left: `${pos}px` }}
                        className="absolute top-0 bottom-0 w-[1px] border-l border-dotted border-slate-300/40 print:border-slate-200"
                      />
                    ))}

                    {/* Monthly Dividers */}
                    {viewMonths.map((m, idx) => {
                      if (idx === 0) return null; // Skip first bit
                      const style = { left: `${idx * monthWidth}px` };
                      return (
                        <div 
                          key={`month-divider-${idx}`} 
                          style={style} 
                          className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-black/5 print:border-slate-200"
                        />
                      );
                    })}

                    {/* Fiscal Year Markers (Vertical Lines) */}
                    {(() => {
                      let currentOffset = 0;
                      return fyBlocks.map((block, idx) => {
                        const style = { left: `${currentOffset}px` };
                        currentOffset += block.count * monthWidth;
                        // Skip the first line if it's at position 0
                        if (idx === 0 && style.left === '0px') return null;
                        return (
                          <div 
                            key={`fy-line-${idx}`} 
                            style={style} 
                            className="absolute top-0 bottom-0 w-0 border-l-[1.5px] border-dashed border-slate-400 z-10 opacity-60 print:opacity-100 print:border-slate-500"
                          />
                        );
                      });
                    })()}
                  </div>

                  {/* Grid / Lanes */}
	                  <div className="relative flex-1 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92)_100%)] print:bg-none print:bg-white">
	                    <div className="flex flex-col print:pt-2">
	                      {filteredExhibitions.length === 0 && (
	                        <div
                            className="absolute top-0 bottom-0 left-0 flex items-center justify-center p-20 pointer-events-none z-40"
                            style={{ width: `calc(100vw - ${SIDEBAR_WIDTH}px)` }}
                          >
                            <div className="max-w-md bg-white/90 border border-slate-200 px-8 py-10 shadow-[0_18px_40px_rgba(15,23,42,0.08)] text-center">
	                            <Search size={40} className="mx-auto mb-4 text-slate-300" />
	                            <p className="text-xl font-semibold uppercase tracking-[0.18em] text-slate-700">No Projects Found</p>
	                            
                              <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 border border-slate-200 bg-slate-50 px-3 py-1.5">
                                <Plus size={12} />
                                New Project
                              </div>
                            </div>
	                        </div>
	                      )}
	                      {portfolioGalleries.map((gallery) => {
	                         const g = gallery.name;
	                         const laneHeight = galleryLaneHeights[g] || BASE_LANE_HEIGHT;
	                         const galleryProjects = filteredProjectsByGallery.get(g) || [];
	                         const isCollapsed = effectiveCollapsedGalleryIds.has(gallery.id);

	                         const isPermanent = gallery.kind === 'permanent';
	                         const headerStripHeight = mhFor(g);
	                         const milestoneBandHeight = milestoneBandHeightFor(g);

                         if (isCollapsed) {
                           return (
                             <div
                               key={gallery.id}
                               style={{ height: `${laneHeight}px` }}
                               className="border-b-2 border-slate-300 relative overflow-hidden bg-white print:bg-slate-100 print:bg-none"
                             >
                               <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,#000_0px,#000_2px,transparent_2px,transparent_6px)]" />
                               <div className="absolute left-0 top-0 bottom-0 w-[3px] z-10 bg-slate-500" />
                               
                               {/* Projects Preview */}
                               <div className="absolute inset-0 pointer-events-none">
                                 {galleryProjects.map((ex, i) => {
                                   const startX = getPositionFromDate(ex.startDate, monthWidth, viewMonths);
                                   const endX = getPositionFromDate(ex.endDate, monthWidth, viewMonths);
                                   const w = Math.max(2, endX - startX);
                                  const styles = getStatusStyles(ex.status);

                                   // Scatter them slightly vertically to show overlap
                                   const y = 8 + (i % 3) * 6;

                                   return (
                                     <div
                                       key={ex.id}
                                       className="absolute h-2.5 rounded-full ring-1 ring-white/50"
                                       style={{
                                         left: `${startX}px`,
                                         width: `${w}px`,
                                         top: `${y}px`,
                                         backgroundColor: styles.barBg,
                                         opacity: 0.35
                                       }}
                                     />
                                   );
                                 })}
                               </div>

                               {/* Tiny project count label */}
                               <div className="absolute right-2 bottom-1 text-[8px] font-bold text-slate-400 pointer-events-none uppercase tracking-tighter opacity-60">
                                 {galleryProjects.length} {galleryProjects.length === 1 ? 'project' : 'projects'}
                               </div>
                             </div>
                           );
                         }

                         return (
		                           <div
                               key={gallery.id}
                               style={{ height: `${laneHeight}px` }}
                               className="border-b-2 border-slate-300 gallery-lane-bg relative overflow-hidden print:overflow-visible shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] bg-white print:bg-white"
                               onDoubleClick={(event) => openQuickAddProject(event, gallery)}
                             >
	                             <div className="absolute left-0 top-0 bottom-0 w-[3px] z-30 pointer-events-none bg-slate-500" />
	                             <div
	                               className="absolute left-0 right-0 bottom-0 pointer-events-none bg-white"
	                               style={{ top: `${headerStripHeight}px`, zIndex: 0 }}
	                             />
	                             <div
	                               className="absolute top-0 left-0 right-0 border-b-2 pointer-events-none bg-slate-100/95 border-slate-300 print:bg-white print:border-slate-300"
	                               style={{ height: `${headerStripHeight}px`, zIndex: 5 }}
	                             />
                               {milestoneBandHeight > 0 && (
                                 <div
                                   className="absolute left-0 right-0 hidden border-b border-slate-200 bg-white print:block"
                                   style={{ top: `${headerStripHeight}px`, height: `${milestoneBandHeight}px`, zIndex: 4 }}
                                 />
                               )}

                              {galleryProjects.map(ex => {
                                const trackIndex = galleryLayouts[g]!.tracks[ex.id];
                                if (trackIndex === undefined || trackIndex === 0) return null;
                                const trackTop = galleryTrackLayouts[g]?.trackTops[trackIndex] ?? trackIndex * currentTrackHeight;
                                return (
	                                  <div key={`line-${ex.id}`} className="absolute w-full border-t border-slate-200 z-10 pointer-events-none" style={{ top: mhFor(g) + milestoneBandHeight + LANE_TOP_PADDING + trackTop }} />
                                );
                              })}

                              {/* In-Lane Project Bars: Fixes print alignment and swimlane bleeding */}
                              <div className="absolute inset-0 pointer-events-none z-20">
                                {(() => {
                                  const printMilestoneLabelBoxes: TimelineRect[] = [];
                                  return galleryProjects.map(ex => {
                                  const trackIndex = galleryLayouts[g]?.tracks[ex.id] || 0;
                                  const isDraggingThis = draggingBarId === ex.id;
                                  const statusStyle = getStatusStyles(ex.status);
                                  
                                  const effStartDate = isDraggingThis && dragTempStartDate ? dragTempStartDate : ex.startDate;
                                  const effEndDate = isDraggingThis && dragTempEndDate ? dragTempEndDate : ex.endDate;

                                  const startPos = getPositionFromDate(effStartDate, monthWidth, viewMonths);
                                  const endPos = getPositionFromDate(effEndDate, monthWidth, viewMonths);
                                  const width = Math.max(endPos - startPos, 40);
                                  
                                  const trackLayout = galleryTrackLayouts[g];
                                  const trackTops = trackLayout?.trackTops ?? [];
                                  const maxTracks = Math.max(1, galleryLayouts[g]?.maxTracks || trackTops.length || 1);
                                  const ownerTrackTop = trackTops[trackIndex] ?? trackIndex * currentTrackHeight;
                                  const projectRowTop = (rowOffset: number) => {
                                    const absoluteTrackIndex = Math.min(trackIndex + rowOffset, maxTracks - 1);
                                    const fallback = ownerTrackTop + (rowOffset * currentTrackHeight);
                                    return mhFor(g) + milestoneBandHeight + LANE_TOP_PADDING + (trackTops[absoluteTrackIndex] ?? fallback);
                                  };

                                  // When resizing a phase belonging to this project, swap in the temp duration
                                  // so the live layout reflects the in-progress drag.
                                  const isResizingPhaseHere = resizingPhase?.projectId === ex.id && phaseResizeTempDuration !== null;
                                  const phaseDurationFor = (p: ProjectPhase) =>
                                    isResizingPhaseHere && p.id === resizingPhase!.phaseId
                                      ? phaseResizeTempDuration!
                                      : p.durationMonths;
                                  const prePhasesRaw = getEffPhases(ex).filter(p => !phaseTypeById.get(p.typeId)?.isPost);
                                  const postPhasesRaw = getEffPhases(ex).filter(p => phaseTypeById.get(p.typeId)?.isPost);
                                  const isSingleDateProject = ex.scheduleMode === 'single-date';
                                  const mainBarY = projectRowTop(0) + (currentTrackHeight - STANDARD_BAR_HEIGHT) / 2;
                                  const markerCenterY = mainBarY + STANDARD_BAR_HEIGHT / 2;
                                  const phaseTintY = mainBarY + STANDARD_BAR_HEIGHT - PHASE_TINT_HEIGHT;

                                  const totalPrePhaseWidthOnly = prePhasesRaw.reduce((acc, p) => acc + phaseDurationFor(p) * monthWidth, 0);
                                  const totalPreGaps = prePhasesRaw.length * PHASE_GAP;
                                  const totalPreWidth = totalPrePhaseWidthOnly + totalPreGaps;
                                  const phaseStartPos = startPos - totalPreWidth;
                                  
                                  let preOffset = 0;
                                  const renderedPre = prePhasesRaw.map((p, i) => {
                                    const pWidth = phaseDurationFor(p) * monthWidth;
                                    const pStart = phaseStartPos + preOffset;
                                    const pEnd = pStart + pWidth;
                                    const pY = phaseTintY;
                                    preOffset += pWidth + PHASE_GAP;
                                    return { ...p, startX: pStart, width: pWidth, endX: pEnd, y: pY, type: phaseTypeById.get(p.typeId), i, isPost: false };
                                  });

                                  let postOffset = PHASE_GAP;
                                  const renderedPost = isSingleDateProject ? [] : postPhasesRaw.map((p, i) => {
                                    const pWidth = phaseDurationFor(p) * monthWidth;
                                    const pStart = endPos + postOffset;
                                    const pEnd = pStart + pWidth;
                                    const pY = phaseTintY;
                                    postOffset += pWidth + PHASE_GAP;
                                    return { ...p, startX: pStart, width: pWidth, endX: pEnd, y: pY, type: phaseTypeById.get(p.typeId), i: i, isPost: true };
                                  });

                                  const renderedPhases = [...renderedPre, ...renderedPost];
                                  const placedMilestoneLabelBoxes: TimelineRect[] = [];
                                  const useMilestoneBand = milestoneBandHeight > 0;
                                  const milestoneLabelRows = useMilestoneBand
                                    ? (isPrintMode ? printMilestoneRowsFor(g) : SCREEN_MILESTONE_LABEL_ROWS).map(offset => mhFor(g) + offset)
                                    : [mainBarY - 30, mainBarY - 52, mainBarY - 74];
                                  const isSelectedMilestoneProject = selectedProjectId === ex.id;
                                  const milestoneLayouts = (ex.checkpoints || []).map((checkpoint) => {
                                    const isDraggingThisMilestone = draggingMilestone?.projectId === ex.id && draggingMilestone.checkpointId === checkpoint.id;
                                    const effectiveMilestoneDate = isDraggingThisMilestone ? draggingMilestone.tempDate : checkpoint.date;
                                    const checkpointX = getPositionFromDate(effectiveMilestoneDate, monthWidth, viewMonths);
                                    const screenFullLabelWidth = Math.min(
                                      300,
                                      Math.max(170, (checkpoint.title.length * 6.4) + 78)
                                    );
                                    const maxPrintLabelWidth = Math.max(220, Math.min(520, totalTimelineWidth - 16));
                                    const printFullLabelWidth = Math.min(
                                      maxPrintLabelWidth,
                                      Math.max(220, (checkpoint.title.length * 7.2) + 96)
                                    );
                                    const fullLabelWidth = isPrintMode ? printFullLabelWidth : screenFullLabelWidth;
                                    const compactLabelWidth = isPrintMode ? 172 : 88;
                                    const fullLabelHeight = isPrintMode ? PRINT_MILESTONE_LABEL_HEIGHT : SCREEN_MILESTONE_LABEL_HEIGHT;
                                    const occupiedMilestoneBoxes = isPrintMode ? printMilestoneLabelBoxes : placedMilestoneLabelBoxes;
                                    const labelLeftFor = (labelWidth: number) => {
                                      const centeredLeft = checkpointX - (labelWidth / 2);
                                      if (!isPrintMode) return centeredLeft;
                                      return Math.max(0, Math.min(centeredLeft, totalTimelineWidth - labelWidth));
                                    };
                                    const findRow = (labelWidth: number) => milestoneLabelRows.find((candidateY) => {
                                      const candidateBox = {
                                        x: labelLeftFor(labelWidth),
                                        y: candidateY,
                                        width: labelWidth,
                                        height: fullLabelHeight,
                                      };
                                      return !occupiedMilestoneBoxes.some(box => timelineRectsOverlap(candidateBox, box, useMilestoneBand ? 8 : 5));
                                    });
                                    const fullRow = findRow(fullLabelWidth);
                                    const shouldCompact = fullRow === undefined && !isPrintMode && !isSelectedMilestoneProject;
                                    const labelWidth = shouldCompact ? compactLabelWidth : fullLabelWidth;
                                    const labelTop = fullRow ?? findRow(labelWidth) ?? milestoneLabelRows[milestoneLabelRows.length - 1];
                                    const labelLeft = labelLeftFor(labelWidth);
                                    const labelBox = {
                                      x: labelLeft,
                                      y: labelTop,
                                      width: labelWidth,
                                      height: fullLabelHeight,
                                    };
                                    occupiedMilestoneBoxes.push(labelBox);
                                    return {
                                      checkpoint,
                                      isDraggingThisMilestone,
                                      effectiveMilestoneDate,
                                      checkpointX,
                                      milestoneKind: MILESTONE_KIND_META[checkpoint.kind] || MILESTONE_KIND_META.other,
                                      labelWidth,
                                      labelLeft,
                                      markerLeft: checkpointX - labelLeft,
                                      labelTop,
                                      isCompact: shouldCompact,
                                      useMilestoneBand,
                                    };
                                  });

                                  return (
                                    <React.Fragment key={ex.id}>
                                      <div className={`absolute pointer-events-none transition-opacity duration-200 ${isDraggingThis ? 'opacity-30' : ''} ${isPrintMode && !printSettings.showPhases ? 'print:hidden' : ''}`}>
                                        {renderedPhases.map((phase) => {
                                          const phaseLabel = phase.type?.label || phase.label;
                                          return (
                                            <React.Fragment key={phase.id}>
                                              <div
                                                className="absolute pointer-events-auto border border-white/70 opacity-70 transition-opacity hover:opacity-95 print:border-white/40 print:opacity-45"
                                                style={{
                                                  left: `${phase.startX}px`,
                                                  top: `${phase.y}px`,
                                                  width: `${Math.max(phase.width - 2, 0)}px`,
                                                  height: `${PHASE_TINT_HEIGHT}px`,
                                                  backgroundColor: phase.type?.color || '#eee',
                                                  zIndex: 18
                                                }}
                                                title={`${phaseLabel} - ${phase.durationMonths} months`}
                                              />
                                              <div
                                                aria-label={`Resize phase ${phaseLabel}`}
                                                className="absolute cursor-ew-resize pointer-events-auto bg-transparent hover:bg-slate-900/15 transition-colors no-print"
                                                style={{
                                                  left: `${phase.endX - EDGE_HIT_ZONE}px`,
                                                  top: `${phase.y - 4}px`,
                                                  width: `${EDGE_HIT_ZONE}px`,
                                                  height: `${PHASE_TINT_HEIGHT + 8}px`,
                                                  zIndex: 27
                                                }}
                                                onPointerDown={(e) => onPhaseHandlePointerDown(e, ex.id, phase as ProjectPhase)}
                                              />
                                            </React.Fragment>
                                          );
                                        })}
                                      </div>

                                      {isSingleDateProject ? (
                                        <div
                                          aria-label={`Project: ${ex.title} (${ex.status}). Single date on ${formatBarDate(effStartDate)}. Click to view details.`}
                                          role="button"
                                          tabIndex={0}
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={() => { if (!draggingBarId) setSelectedProjectId(ex.id); }}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProjectId(ex.id); }}
                                          className={`absolute pointer-events-auto cursor-pointer flex items-center focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${isDraggingThis ? 'project-bar-dragging ring-1 ring-blue-500' : ''}`}
                                          style={{
                                            left: `${startPos - 7}px`,
                                            top: `${mainBarY + STANDARD_BAR_HEIGHT / 2}px`,
                                            transform: 'translateY(-50%)',
                                            zIndex: 25
                                          }}
                                          title={`${ex.title} — ${formatBarDate(effStartDate)}`}
                                        >
                                          <div
                                            className="w-3.5 h-3.5 border-[1.5px] border-slate-900 rotate-45 shadow-[1px_1px_0_0_rgba(0,0,0,1)] flex items-center justify-center print:shadow-none"
                                            style={{ backgroundColor: statusStyle.barBg }}
                                          >
                                            <div className="w-[4px] h-[4px] bg-white" />
                                          </div>
                                          <div className="ml-2 inline-flex items-center gap-1.5 bg-white px-1.5 py-[3px] leading-none border border-slate-200 shadow-sm print:bg-transparent print:border-none print:shadow-none">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-800 whitespace-nowrap">{ex.title}</span>
                                            <span className="w-px h-2 bg-slate-300" />
                                            <span className="text-[9px] font-medium uppercase tracking-[0.04em] text-slate-600 whitespace-nowrap">{formatBarDate(effStartDate)}</span>
                                          </div>
                                          <button
                                            type="button"
                                            aria-label={`Quick edit ${ex.title}`}
                                            title="Quick edit"
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onClick={(event) => openProjectQuickEdit(event, ex)}
                                            className="ml-1 flex h-5 w-5 items-center justify-center border border-slate-300 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-900 no-print"
                                          >
                                            <Edit2 size={11} />
                                          </button>
                                          <button
                                            type="button"
                                            aria-label={`Add milestone to ${ex.title}`}
                                            title="Add milestone"
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onClick={(event) => openMilestoneQuickEdit(event, ex, effStartDate)}
                                            className="ml-1 flex h-5 w-5 items-center justify-center border border-slate-300 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-900 no-print"
                                          >
                                            <Flag size={11} />
                                          </button>
                                          <button
                                            type="button"
                                            aria-label={`Move ${ex.title}`}
                                            title="Drag to move"
                                            onPointerDown={(event) => onBarDragPointerDown(event, ex)}
                                            onClick={(event) => event.stopPropagation()}
                                            className="ml-1 flex h-5 w-5 items-center justify-center border border-slate-300 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-900 cursor-grab active:cursor-grabbing no-print"
                                          >
                                            <GripVertical size={12} />
                                          </button>
                                        </div>
                                      ) : (
                                      <div
                                        aria-label={`Project: ${ex.title} (${ex.status}). Click to view details, use the grip handle to drag.`}
                                        role="button"
                                        tabIndex={0}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => { if (!draggingBarId) setSelectedProjectId(ex.id); }}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProjectId(ex.id); }}
                                        className={`group absolute pointer-events-auto shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/50 print:shadow-none ${isDraggingThis ? 'project-bar-dragging ring-2 ring-blue-500' : ''}`}
                                        style={{
                                          left: `${startPos}px`,
                                          width: `${width}px`,
                                          top: `${mainBarY}px`,
                                          height: `${STANDARD_BAR_HEIGHT}px`,
                                          borderRadius: '2px',
                                          backgroundColor: statusStyle.barBg,
                                        }}
                                        title={`${ex.title} · ${ex.status} · ${formatBarDate(effStartDate)}–${formatBarDate(effEndDate)}`}
                                      >
                                          <div
                                            className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-1 pl-3"
                                            style={{ paddingRight: width >= 170 ? '76px' : width >= 95 ? '52px' : '8px' }}
                                          >
                                            <span 
                                              className="block truncate text-[11px] font-semibold leading-none"
                                              style={{ color: statusStyle.barText }}
                                            >
                                              {ex.title}
                                            </span>
                                            {width >= 126 && (
                                              <span 
                                                className="block truncate font-mono text-[9px] font-bold leading-none opacity-90"
                                                style={{ color: statusStyle.barText }}
                                              >
                                                {formatBarDate(effStartDate)}–{formatBarDate(effEndDate)}
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            className="absolute right-0 top-0 bottom-0 z-[32] flex items-center justify-center gap-1 border-l border-white/35 bg-white/20 px-1.5 no-print backdrop-blur-[1px]"
                                            style={{ width: width >= 170 ? '72px' : width >= 95 ? '48px' : '0px', display: width >= 95 ? 'flex' : 'none' }}
                                            onClick={(event) => event.stopPropagation()}
                                            onPointerDown={(event) => event.stopPropagation()}
                                          >
                                            <button
                                              type="button"
                                              aria-label={`Quick edit ${ex.title}`}
                                              title="Quick edit"
                                              onClick={(event) => openProjectQuickEdit(event, ex)}
                                              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center border border-white/50 bg-white/45 text-slate-900/75 hover:bg-white/70 hover:text-slate-950"
                                            >
                                              <Edit2 size={11} />
                                            </button>
                                            {width >= 170 && (
                                              <button
                                                type="button"
                                                aria-label={`Add milestone to ${ex.title}`}
                                                title="Add milestone"
                                                onClick={(event) => openMilestoneQuickEdit(event, ex, effStartDate)}
                                                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center border border-white/50 bg-white/45 text-slate-900/75 hover:bg-white/70 hover:text-slate-950"
                                              >
                                                <Flag size={11} />
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              aria-label={`Move ${ex.title}`}
                                              title="Drag to move"
                                              onPointerDown={(event) => onBarDragPointerDown(event, ex)}
                                              onClick={(event) => event.stopPropagation()}
                                              className="flex h-[18px] w-[18px] shrink-0 cursor-grab items-center justify-center border border-white/50 bg-white/45 text-slate-900/75 hover:bg-white/70 hover:text-slate-950 active:cursor-grabbing"
                                            >
                                              <GripVertical size={12} />
                                            </button>
                                          </div>
                                          {width < 126 && width >= 80 && (
                                            <span 
                                              className="pointer-events-none absolute left-3 bottom-[5px] block max-w-[calc(100%-62px)] truncate font-mono text-[8px] font-bold leading-none opacity-85"
                                              style={{ color: statusStyle.barText }}
                                            >
                                              {formatBarDate(effStartDate)}–{formatBarDate(effEndDate)}
                                            </span>
                                          )}
                                          <div
                                            aria-label="Resize start date"
                                            className="absolute left-0 top-0 bottom-0 cursor-ew-resize bg-white/10 hover:bg-white/35 transition-colors no-print"
                                            style={{ width: `${EDGE_HIT_ZONE}px`, zIndex: 27 }}
                                            onPointerDown={(e) => onEdgePointerDown(e, ex, 'left')}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <div
                                            aria-label="Resize end date"
                                            className="absolute right-0 top-0 bottom-0 cursor-ew-resize bg-white/10 hover:bg-white/35 transition-colors no-print"
                                            style={{ width: `${EDGE_HIT_ZONE}px`, zIndex: 27 }}
                                            onPointerDown={(e) => onEdgePointerDown(e, ex, 'right')}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                      </div>
                                      )}

                                      {/* External title pill for bars too narrow to display a readable title. */}
                                      {!isSingleDateProject && width < 80 && (() => {
                                        const lastPostEndX = renderedPost.length > 0
                                          ? renderedPost[renderedPost.length - 1].endX
                                          : endPos;
                                        return (
                                          <div
                                            className="absolute pointer-events-none inline-flex max-w-[180px] flex-col gap-[3px] bg-white px-1.5 py-[4px] leading-none border border-slate-200 shadow-sm"
                                            style={{
                                              left: `${lastPostEndX + 6}px`,
                                              top: `${mainBarY + STANDARD_BAR_HEIGHT / 2}px`,
                                              transform: 'translateY(-50%)',
                                              zIndex: 24,
                                            }}
                                            title={ex.title}
                                          >
                                            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-800">{ex.title}</span>
                                            <span className="truncate font-mono text-[8px] font-semibold uppercase tracking-[0.02em] text-slate-500">
                                              {formatBarDate(effStartDate)}–{formatBarDate(effEndDate)}
                                            </span>
                                          </div>
                                        );
                                      })()}

                                      {milestoneLayouts.map(({ checkpoint, isDraggingThisMilestone, effectiveMilestoneDate, checkpointX, milestoneKind, labelWidth, labelLeft, markerLeft, labelTop, isCompact, useMilestoneBand }) => {
                                        const MilestoneKindIcon = milestoneKind.Icon;
                                        const markerTop = markerCenterY - labelTop;
                                        const connectorTop = isPrintMode ? PRINT_MILESTONE_LABEL_HEIGHT - 1 : SCREEN_MILESTONE_LABEL_HEIGHT - 1;
                                        const connectorHeight = Math.max(0, markerTop - connectorTop - 7);
                                        return (
                                          <div
                                            key={`milestone-${checkpoint.id}`}
                                            className={`absolute pointer-events-auto ${isDraggingThisMilestone ? 'cursor-grabbing' : 'cursor-grab'}`}
                                            style={{
                                              left: `${labelLeft}px`,
                                              top: `${labelTop}px`,
                                              width: `${labelWidth}px`,
                                              height: `${markerTop + 12}px`,
                                              zIndex: isSelectedMilestoneProject || isDraggingThisMilestone ? 36 : 31,
                                            }}
                                            title={`${checkpoint.title} - ${milestoneKind.label} - ${formatBarDate(effectiveMilestoneDate)}`}
                                            role="button"
                                            aria-label={`Drag milestone ${checkpoint.title}`}
                                            onPointerDown={(e) => onMilestonePointerDown(e, ex, checkpoint.id, effectiveMilestoneDate)}
                                            onClick={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                          >
                                            {useMilestoneBand && connectorHeight > 0 && (
                                              <div
                                                className="absolute block w-px -translate-x-1/2 bg-slate-400/80 print:bg-slate-500"
                                                style={{ left: `${markerLeft}px`, top: `${connectorTop}px`, height: `${connectorHeight}px` }}
                                                aria-hidden="true"
                                              />
                                            )}
                                            <div
                                              className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-slate-900 shadow-[1px_1px_0_0_rgba(0,0,0,1)] print:shadow-none ${milestoneKind.markerClass}`}
                                              style={{ left: `${markerLeft}px`, top: `${markerTop}px` }}
                                              aria-hidden="true"
                                            />
                                            <div
                                              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white"
                                              style={{ left: `${markerLeft}px`, top: `${markerTop}px` }}
                                              aria-hidden="true"
                                            />
                                            <div
                                              className={`absolute left-0 top-0 pointer-events-auto bg-white border px-1.5 py-[3px] shadow-sm print:bg-white print:shadow-none ${isSelectedMilestoneProject ? 'border-slate-600' : milestoneKind.labelBorderClass}`}
                                              style={{ width: `${labelWidth}px`, zIndex: 32 }}
                                              onPointerDown={(e) => onMilestonePointerDown(e, ex, checkpoint.id, effectiveMilestoneDate)}
                                            >
                                              <div
                                                className={`absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-[5px] rotate-45 border-b border-r bg-white ${useMilestoneBand ? 'hidden' : ''} ${isSelectedMilestoneProject ? 'border-slate-600' : milestoneKind.labelBorderClass}`}
                                                aria-hidden="true"
                                              />
                                              <div className={`flex min-w-0 items-center leading-none ${isPrintMode ? 'gap-1.5' : 'gap-1.5'}`}>
                                                <span className={`flex shrink-0 items-center justify-center border ${isPrintMode ? 'h-4 w-4' : 'h-3.5 w-3.5'} ${milestoneKind.iconClass}`} title={milestoneKind.label}>
                                                  <MilestoneKindIcon size={isPrintMode ? 10 : 9} strokeWidth={2.25} />
                                                </span>
                                                {!isCompact && (
                                                  <>
                                                    <span className={`font-semibold uppercase tracking-[0.04em] text-slate-800 ${isPrintMode ? 'whitespace-nowrap text-[10px]' : 'min-w-0 truncate text-[9px]'}`}>{checkpoint.title}</span>
                                                    <span className={`${isPrintMode ? 'h-3' : 'h-2.5'} w-px shrink-0 bg-slate-300`} />
                                                  </>
                                                )}
                                                <span className={`shrink-0 font-semibold uppercase tracking-[0.04em] text-slate-600 ${isPrintMode ? 'text-[10px]' : 'text-[9px]'}`}>{formatMilestoneDate(effectiveMilestoneDate)}</span>
                                                <button
                                                  type="button"
                                                  aria-label={`Edit milestone ${checkpoint.title}`}
                                                  title="Edit milestone"
                                                  onPointerDown={(event) => event.stopPropagation()}
                                                  onClick={(event) => openMilestoneQuickEdit(event, ex, effectiveMilestoneDate, checkpoint.id)}
                                                  className="no-print ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                                >
                                                  <Edit2 size={8} />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                    </React.Fragment>
                                  );
                                  });
                                })()}
                              </div>
                           </div>
                         );
                      })}
                    </div>
                    
                    <div className="absolute inset-0 flex pointer-events-none z-0">
                      {viewMonths.map((m) => <div key={`bg-${m.year}-${m.month}`} style={{ width: `${monthWidth}px` }} className={`h-full border-r border-slate-200/5 print:border-slate-200 shrink-0 ${m.month === 3 ? 'border-l-[1.5px] border-dashed border-slate-400/20 print:border-slate-400' : ''}`} />)}
                    </div>
                  </div>
                </div>
              </main>
              {isPrintMode && printSettings.footerNote && (
                <div className="hidden print:block mt-6 px-4 py-3 border-t border-slate-200 text-right">
                  <p className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">
                    {printSettings.footerNote}
                  </p>
                </div>
              )}
              {isPrintMode && printSettings.includeSummary && (
                <div className="hidden print:block mt-12 px-4 pt-8 border-t border-slate-300 break-before-page">
                  <h2 className="text-[14px] font-bold uppercase tracking-[0.2em] text-slate-900 mb-6 border-b border-slate-900 pb-2">Project Inventory & Phase Log</h2>
                  <div className="space-y-8">
                    {portfolioGalleries.map(gallery => {
                      const galleryProjects = filteredProjectsByGallery.get(gallery.name) || [];
                      if (galleryProjects.length === 0) return null;
                      return (
                        <div key={`log-gal-${gallery.id}`} className="space-y-4">
                          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] bg-slate-900 text-white px-2 py-1 inline-block">{gallery.name}</h3>
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-300">
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 w-1/4">Project</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 w-1/6">Status</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 w-1/6">Timeline</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Phases & Milestones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {galleryProjects.map(ex => (
                                <tr key={`log-row-${ex.id}`} className="border-b border-slate-200 align-top">
                                  <td className="py-3 pr-4">
                                    <div className="text-[11px] font-bold text-slate-900">{ex.title}</div>
                                    {ex.exhibitionId && <div className="text-[9px] font-mono text-slate-400 mt-0.5">{ex.exhibitionId}</div>}
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span className="text-[9px] font-semibold uppercase tracking-tight px-1.5 py-0.5 border border-slate-200 text-slate-600">
                                      {ex.status}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <div className="text-[10px] text-slate-700 font-medium">{formatBarDate(ex.startDate)}</div>
                                    <div className="text-[10px] text-slate-400">— {formatBarDate(ex.endDate)}</div>
                                  </td>
                                  <td className="py-3">
                                    <div className="space-y-2">
                                      {(ex.phases || []).length > 0 && (
                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                          {ex.phases?.map(p => (
                                            <div key={p.id} className="text-[9px] text-slate-600">
                                              <span className="font-bold">{phaseTypeById.get(p.typeId)?.label || p.label}:</span>
                                              <span className="ml-1 text-slate-400">{p.durationMonths}m</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {(ex.checkpoints || []).length > 0 && (
                                        <div className="bg-slate-50 p-2 border border-slate-100 rounded-sm">
                                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Key Milestones</div>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            {ex.checkpoints?.map(checkpoint => (
                                              <div key={checkpoint.id} className="flex justify-between items-baseline gap-2">
                                                <span className="text-[9px] text-slate-700 truncate">{checkpoint.title}</span>
                                                <span className="text-[8px] font-mono text-slate-400 shrink-0">{formatBarDate(checkpoint.date)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
        ) : (
          <div className="fixed inset-0 z-[135] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] no-print">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
              className="flex h-[min(760px,calc(100vh-48px))] w-[min(980px,calc(100vw-32px))] flex-col border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-tight text-slate-700">Settings</h2>
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 bg-white px-2 py-1 leading-none transition-colors"
                >
                  <X size={11} /> Close
                </button>
              </div>
              <div className="grid flex-1 gap-3 overflow-y-auto bg-slate-50 p-4 custom-scrollbar lg:grid-cols-[minmax(260px,0.8fr)_minmax(360px,1.1fr)]">

              <section className="border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Building2 size={12} className="text-slate-600" />
                  <span className="text-[11px] font-semibold uppercase tracking-tight text-slate-700">Organization</span>
                </div>
                <div className="space-y-1">
                  <label htmlFor="museum-name-input" className="text-[10px] font-medium uppercase tracking-tight text-slate-600">Organization name</label>
                  <input
                    id="museum-name-input"
                    className="w-full bg-white border border-slate-200 px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 transition-colors uppercase tracking-tight"
                    value={museumName}
                    onChange={(e) => setMuseumName(e.target.value.toUpperCase())}
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white p-3 space-y-2 lg:row-span-2">
                <div className="flex items-center gap-1.5">
                  <Palette size={12} className="text-slate-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-tight text-slate-700">Phase types</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {phaseTypes.map((type, idx) => (
                    <div key={type.id} className="flex items-center gap-2 p-2 border border-slate-200 bg-white">
                      <label htmlFor={`phase-color-${idx}`} className="sr-only">Phase Color {idx + 1}</label>
                      <input
                        id={`phase-color-${idx}`}
                        type="color"
                        className="w-6 h-6 border border-slate-200 bg-transparent cursor-pointer outline-none shrink-0"
                        value={type.color}
                        onChange={(e) => {
                          const next = [...phaseTypes];
                          next[idx].color = e.target.value;
                          setPhaseTypes(next);
                        }}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <label htmlFor={`phase-label-${idx}`} className="sr-only">Phase Label {idx + 1}</label>
                        <input
                          id={`phase-label-${idx}`}
                          className="w-full text-[11px] font-medium text-slate-900 outline-none border-b border-transparent focus:border-slate-300 bg-transparent uppercase tracking-tight"
                          value={type.label}
                          onChange={(e) => {
                            const next = [...phaseTypes];
                            next[idx].label = e.target.value.toUpperCase();
                            setPhaseTypes(next);
                          }}
                        />
                        <div className="flex items-center gap-1">
                          {type.isActive && <span className="px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-800 text-[9px] font-medium uppercase tracking-tight leading-none">Active</span>}
                          {type.isPost && <span className="px-1.5 py-0.5 border border-slate-200 bg-slate-100 text-slate-600 text-[9px] font-medium uppercase tracking-tight leading-none">Post</span>}
                          {!type.isActive && !type.isPost && <span className="px-1.5 py-0.5 border border-slate-200 bg-white text-slate-500 text-[9px] font-medium uppercase tracking-tight leading-none">Prep</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-tight text-slate-700">Locations</span>
                  </div>
                  <button
                    onClick={handleAddGallery}
                    className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none"
                  >
                    <Plus size={10} strokeWidth={2.5} /> Add
                  </button>
                </div>
                <div className="space-y-1.5">
                  {galleries.map((gallery, idx) => (
                    <div key={gallery.id} className="flex items-center gap-2 p-2 border border-slate-200 bg-white">
                      <div className="w-5 h-5 bg-slate-900 text-white flex items-center justify-center font-medium text-[10px] shrink-0 leading-none">{idx + 1}</div>
                      <input
                        aria-label={`Location name ${idx + 1}`}
                        className="flex-1 min-w-0 text-[11px] font-medium text-slate-900 uppercase tracking-tight border-b border-transparent focus:border-slate-300 bg-transparent outline-none py-0.5"
                        defaultValue={gallery.name}
                        onBlur={(e) => {
                          const next = e.target.value.toUpperCase().trim();
                          if (next && next !== gallery.name) handleRenameGallery(gallery.id, next);
                          else e.target.value = gallery.name;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') {
                            (e.target as HTMLInputElement).value = gallery.name;
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <div className="inline-flex border border-slate-200 overflow-hidden text-[9px] font-medium uppercase tracking-tight shrink-0 leading-none" role="group" aria-label={`Gallery type for ${gallery.name}`}>
                        <button
                          type="button"
                          onClick={() => handleSetGalleryKind(gallery.id, 'temporary')}
                          className={`px-2 py-1 transition-colors ${gallery.kind !== 'permanent' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          aria-pressed={gallery.kind !== 'permanent'}
                        >
                          Temp
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetGalleryKind(gallery.id, 'permanent')}
                          className={`px-2 py-1 border-l border-slate-200 transition-colors ${gallery.kind === 'permanent' ? 'bg-amber-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          aria-pressed={gallery.kind === 'permanent'}
                        >
                          Perm
                        </button>
                      </div>
                      <button
                        aria-label={`Remove location ${gallery.name}`}
                        disabled={galleries.length <= 1}
                        onClick={() => handleRemoveGallery(gallery.id)}
                        className={`p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors ${galleries.length <= 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {activeTab === 'portfolio' && (
        <footer className="fixed bottom-0 left-0 right-0 z-[130] h-7 bg-white border-t border-slate-200 flex items-center justify-between gap-3 px-3 text-[10px] text-slate-600 leading-none print:hidden">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-semibold uppercase tracking-[0.08em] text-slate-500">Status</span>
              {ALL_STATUSES.map(status => {
                const statusStyle = getStatusStyles(status);
                const shortLabel = status === 'Open to Public'
                  ? 'Open'
                  : status === 'In Development'
                    ? 'Dev'
                    : status;
                return (
                  <span key={status} className="inline-flex items-center gap-1" title={status}>
                    <span className="h-2 w-3 border border-slate-300" style={{ backgroundColor: statusStyle.barBg }} />
                    <span className="font-medium text-slate-600">{shortLabel}</span>
                  </span>
                );
              })}
            </div>
            {phaseTypes.length > 0 && (
              <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-slate-500">Phases</span>
                <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                  {phaseTypes.map(type => (
                    <span key={type.id} className="inline-flex min-w-0 shrink-0 items-center gap-1" title={type.label}>
                      <span className="h-1.5 w-4 border border-slate-300" style={{ backgroundColor: type.color }} />
                      <span className="max-w-20 truncate font-medium text-slate-600">{type.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="shrink-0 font-mono text-slate-500">PortfolioTool-v3 by SB</span>
        </footer>
      )}
    </div>
  );
}
