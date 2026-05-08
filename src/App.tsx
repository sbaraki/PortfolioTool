import { useStore } from '\.\/store/useStore';
import { useMuseumSync } from '\.\/hooks/useMuseumSync';
import { useMuseumActions } from '\.\/hooks/useMuseumActions';
import { getStatusStyles, MONTHS, FY_QUARTERS, BASE_LANE_HEIGHT, COLLAPSED_LANE_HEIGHT, TRACK_HEIGHT, HEADER_HEIGHT, STANDARD_BAR_HEIGHT, PHASE_BAR_HEIGHT, LANE_TOP_PADDING, LANE_BOTTOM_PADDING, PHASE_GAP, WEEKLY_GRID_THRESHOLD, EDGE_HIT_ZONE, PROJECT_MILESTONE_ROW_HEIGHT, MILESTONE_ICON_BAND_HEIGHT, MILESTONE_LABEL_ROW_HEIGHT, MILESTONE_LABEL_MAX_WIDTH, MILESTONE_ROW_HEIGHT, EMPTY_MILESTONE_ROW_HEIGHT, GALLERY_HEADER_HEIGHT, PRINT_DPI, PRINT_PAGE_SIZES_IN, PRINT_MARGIN_IN, MIN_PRINT_SCALE, MIN_READABLE_PRINT_SCALE, PRINT_SHELL_PADDING_X, PRINT_SHELL_PADDING_Y, PRINT_COLUMN_GAP } from '\.\/constants';
import { toISODate, getPositionFromDate, getDateFromPosition, formatBarDate, getDateWithMonthDuration, getDurationDays, snapDate } from '\.\/lib/dateUtils';
import { calculateTracks, packMilestoneLabels } from '\.\/lib/layoutEngine';
import { calculatePrintScale } from '\.\/lib/printLayout';
import { exportExhibitionsToCSV } from '\.\/lib/exportUtils';
import { Exhibition, Gallery, GalleryKind, PhaseType, ProjectMilestone, ProjectPhase, ExhibitionStatus, LocationMilestone, PrintSettings } from '\.\/types';
import { DetailPanel } from '\.\/components/DetailPanel';
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
  ArrowLeft,
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

import { GithubAuthModal } from '\.\/components/GithubAuthModal';

// --- Main App ---

const ALL_STATUSES: ExhibitionStatus[] = ['TBC', 'In Development', 'Open to Public', 'Closed'];

const MilestoneLabel = ({
  title,
  date,
  labelFontSize,
  dateFontSize,
  isTwoLine,
}: {
  title: string;
  date: string;
  labelFontSize: number;
  dateFontSize: number;
  isTwoLine: boolean;
}) => {
  const formattedDate = formatBarDate(date);

  if (isTwoLine) {
    return (
      <div className="flex h-full min-w-0 flex-col items-center justify-center gap-[2px] text-center leading-none">
        <span
          className="font-semibold uppercase tracking-[0.04em] text-slate-800 whitespace-nowrap"
          style={{ fontSize: `${labelFontSize}px` }}
        >
          {title}
        </span>
        <span
          className="font-medium uppercase tracking-[0.04em] text-slate-600 whitespace-nowrap"
          style={{ fontSize: `${dateFontSize}px` }}
        >
          {formattedDate}
        </span>
      </div>
    );
  }

  return (
    <>
      <span
        className="font-semibold uppercase tracking-[0.06em] text-slate-800 min-w-0 whitespace-nowrap"
        style={{ fontSize: `${labelFontSize}px` }}
      >
        {title}
      </span>
      <span className="w-px h-2 bg-slate-300 shrink-0" />
      <span
        className="font-medium uppercase tracking-[0.04em] text-slate-600 shrink-0 whitespace-nowrap"
        style={{ fontSize: `${dateFontSize}px` }}
      >
        {formattedDate}
      </span>
    </>
  );
};


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
  fontSizeMultiplier: 1.0,
  footerNote: '',
};

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

export default function MasterScheduler() {
  const SIDEBAR_WIDTH = 220;
  const { currentUser, syncStatus } = useMuseumSync();
  const {
    museumName, setMuseumName,
    galleries, setGalleries,
    phaseTypes, setPhaseTypes,
    exhibitions, setExhibitions,
    locationMilestones,
    monthWidth, setMonthWidth,
    timelineStartDate, setTimelineStartDate,
    timelineEndDate, setTimelineEndDate,
    commitHistory, undo, redo, historyPast, historyFuture
  } = useStore();
  const [, setEditMilestoneDraft] = useState<LocationMilestone | null>(null);
  const { handleUpdateExhibition, handleRemoveExhibition, handleRenameGallery, handleSetGalleryKind, handleAddGallery, handleRemoveGallery, handleDuplicateProject } = useMuseumActions();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'settings'>('portfolio');
  const [showGithubAuth, setShowGithubAuth] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [isPrintMode, setIsPrintMode] = useState(false);
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
    milestoneId: string;
    initialMouseX: number;
    initialDate: string;
    tempDate: string;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressMilestoneClickRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (modifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Edge-drag resize state — separate from long-press move so resize starts instantly.
  const [resizingEdge, setResizingEdge] = useState<{ id: string; edge: 'left' | 'right' } | null>(null);
  const resizeInitialMouseXRef = useRef(0);
  const resizeInitialStartDateRef = useRef('');
  const resizeInitialEndDateRef = useRef('');

  // Phase resize (right-edge drag on phase bar updates durationMonths).
  const [resizingPhase, setResizingPhase] = useState<{ projectId: string; phaseId: string } | null>(null);
  const phaseResizeInitialMouseXRef = useRef(0);
  const phaseResizeInitialDurationRef = useRef(0);
  const [phaseResizeTempDuration, setPhaseResizeTempDuration] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

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
    return exhibitions.filter(ex => effectiveStatuses.has(ex.status) && visibleGalleryNames.has(ex.gallery));
  }, [exhibitions, effectiveStatuses, portfolioGalleries]);

  const printProjectMilestoneCount = filteredExhibitions.reduce((sum, ex) => sum + (ex.milestones?.length || 0), 0);

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
      const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === gallery.name);
      const layoutInfo = calculateTracks(galleryProjects, monthWidth, viewMonths, phaseTypes);
      layouts[gallery.name] = { tracks: layoutInfo.tracks, maxTracks: layoutInfo.maxTracks };
    });
    return layouts;
  }, [filteredExhibitions, portfolioGalleries, monthWidth, viewMonths, phaseTypes]);

  const galleryMilestoneRowHeights = useMemo(() => {
    const heights: Record<string, number> = {};
    portfolioGalleries.forEach(gallery => {
      const packed = packMilestoneLabels<LocationMilestone & { xPos: number }>(
        locationMilestones
          .filter(m => m.gallery === gallery.name)
          .map(m => ({ ...m, xPos: getPositionFromDate(m.date, monthWidth, viewMonths) }))
      );
      heights[gallery.name] = packed.items.length > 0
        ? Math.max(MILESTONE_ROW_HEIGHT, MILESTONE_ICON_BAND_HEIGHT + (packed.rowCount * MILESTONE_LABEL_ROW_HEIGHT) + 6)
        : EMPTY_MILESTONE_ROW_HEIGHT;
    });
    return heights;
  }, [portfolioGalleries, locationMilestones, monthWidth, viewMonths]);

  // Top-strip height for a gallery lane. Both the sidebar (gallery-name header) and
  // the timeline (location-milestone strip) reserve this much vertical room before
  // project tracks start so the two columns stay vertically aligned. Always at least
  // GALLERY_HEADER_HEIGHT so gallery names are never clipped, even when the lane has
  // no milestones.
  const mhFor = (galleryName: string) => Math.max(
    galleryMilestoneRowHeights[galleryName] ?? EMPTY_MILESTONE_ROW_HEIGHT,
    GALLERY_HEADER_HEIGHT
  );


  const getProjectPhaseRows = (project: Exhibition) => {
    const prePhasesCount = (project.phases || []).filter(p => !phaseTypes.find(t => t.id === p.typeId)?.isPost).length;
    return Math.max(1, prePhasesCount + 1);
  };

  const getProjectLastAllocatedTrackIndex = (project: Exhibition, startTrack: number, maxTracks: number) => (
    Math.min(startTrack + getProjectPhaseRows(project) - 1, Math.max(0, maxTracks - 1))
  );

  const getProjectMilestoneBandHeight = (labelRows: number) => (
    labelRows > 0
      ? Math.max(PROJECT_MILESTONE_ROW_HEIGHT, MILESTONE_ICON_BAND_HEIGHT + (labelRows * MILESTONE_LABEL_ROW_HEIGHT) + 8)
      : 0
  );

  // For each gallery, compute per-track top offsets. Tracks whose project carries
  // ProjectMilestone entries get a dynamically sized band that expands with label
  // density at the current zoom level so milestone pills never bleed into the next
  // project track or gallery.
  const galleryTrackLayouts = useMemo(() => {
    const out: Record<string, { trackTops: number[]; total: number; trackMilestoneRows: number[]; trackHeights: number[] }> = {};
    portfolioGalleries.forEach(gallery => {
      const layout = galleryLayouts[gallery.name];
      const maxTracks = layout?.maxTracks || 1;
      const trackMilestoneRows = new Array(maxTracks).fill(0);
      filteredExhibitions.forEach(ex => {
        if (ex.gallery !== gallery.name) return;
        if ((ex.milestones || []).length === 0) return;
        const ti = layout?.tracks[ex.id];
        if (ti === undefined) return;
        // calculateTracks reserves one row per pre-phase plus the main-bar row.
        // Attach the milestone band to the project's actual last allocated row,
        // independent of gallery-level milestone strips.
        const lastTrackIdx = getProjectLastAllocatedTrackIndex(ex, ti, maxTracks);
        const packed = packMilestoneLabels<ProjectMilestone & { xPos: number }>(
          (ex.milestones || []).map(pm => ({ ...pm, xPos: getPositionFromDate(pm.date, monthWidth, viewMonths) }))
        );
        trackMilestoneRows[lastTrackIdx] = Math.max(trackMilestoneRows[lastTrackIdx], packed.rowCount);
      });
      const trackTops: number[] = [];
      const trackHeights: number[] = [];
      let acc = 0;
      for (let i = 0; i < maxTracks; i++) {
        trackTops.push(acc);
        const rows = trackMilestoneRows[i];
        const milestoneBand = getProjectMilestoneBandHeight(rows);
        const h = TRACK_HEIGHT + milestoneBand;
        trackHeights.push(h);
        acc += h;
      }
      out[gallery.name] = { trackTops, total: acc, trackMilestoneRows, trackHeights };
    });
    return out;
  }, [portfolioGalleries, galleryLayouts, filteredExhibitions, phaseTypes, monthWidth, viewMonths]);


  const galleryLaneHeights = useMemo(() => {
    return portfolioGalleries.reduce((acc, gallery) => {
      if (effectiveCollapsedGalleryIds.has(gallery.id)) {
        acc[gallery.name] = COLLAPSED_LANE_HEIGHT;
        return acc;
      }
      const tracksTotal = galleryTrackLayouts[gallery.name]?.total || TRACK_HEIGHT;
      const topStrip = mhFor(gallery.name);
      acc[gallery.name] = Math.max(
        BASE_LANE_HEIGHT,
        topStrip + LANE_TOP_PADDING + tracksTotal + LANE_BOTTOM_PADDING
      );
      return acc;
    }, {} as Record<string, number>);
  }, [portfolioGalleries, galleryTrackLayouts, effectiveCollapsedGalleryIds, galleryMilestoneRowHeights]);

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

  const activeMilestoneDragFeedback = draggingMilestone
    ? {
        date: draggingMilestone.tempDate,
        x: getPositionFromDate(draggingMilestone.tempDate, monthWidth, viewMonths),
      }
    : null;

  const activeDragFeedback = (draggingBarId || resizingEdge) && dragTempStartDate && dragTempEndDate
    ? {
        startDate: dragTempStartDate,
        endDate: dragTempEndDate,
        startX: getPositionFromDate(dragTempStartDate, monthWidth, viewMonths),
        endX: getPositionFromDate(dragTempEndDate, monthWidth, viewMonths),
        mode: draggingBarId ? 'move' : resizingEdge?.edge === 'left' ? 'start resize' : 'end resize'
      }
    : null;

  const onBarMouseDown = (e: React.MouseEvent, project: Exhibition) => {
    if (e.button !== 0) return;
    const projectX = getPositionFromDate(project.startDate, monthWidth, viewMonths);
    const durationDays = getDurationDays(project.startDate, project.endDate);
    const mouseX = e.clientX;

    longPressTimerRef.current = window.setTimeout(() => {
      dragStartMouseXRef.current = mouseX;
      dragStartProjectXRef.current = projectX;
      dragDurationDaysRef.current = durationDays;
      setDragTempStartDate(project.startDate);
      setDragTempEndDate(project.endDate);
      setDraggingBarId(project.id);
    }, 400);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onEdgeMouseDown = (e: React.MouseEvent, project: Exhibition, edge: 'left' | 'right') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    clearLongPress();
    resizeInitialMouseXRef.current = e.clientX;
    resizeInitialStartDateRef.current = project.startDate;
    resizeInitialEndDateRef.current = project.endDate;
    setResizingEdge({ id: project.id, edge });
    setDragTempStartDate(project.startDate);
    setDragTempEndDate(project.endDate);
  };

  const onPhaseHandleMouseDown = (e: React.MouseEvent, projectId: string, phase: ProjectPhase) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    clearLongPress();
    phaseResizeInitialMouseXRef.current = e.clientX;
    phaseResizeInitialDurationRef.current = phase.durationMonths;
    setResizingPhase({ projectId, phaseId: phase.id });
    setPhaseResizeTempDuration(phase.durationMonths);
  };

  const onMilestoneMouseDown = (e: React.MouseEvent, projectId: string, milestone: ProjectMilestone) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    clearLongPress();
    setIsDraggingScroll(false);
    suppressMilestoneClickRef.current = false;
    setDraggingMilestone({
      projectId,
      milestoneId: milestone.id,
      initialMouseX: e.clientX,
      initialDate: milestone.date,
      tempDate: milestone.date,
    });
  };

  const commitResize = () => {
    if (resizingEdge && dragTempStartDate && dragTempEndDate) {
      const ex = exhibitions.find(p => p.id === resizingEdge.id);
      if (ex) {
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
      const ex = exhibitions.find(p => p.id === resizingPhase.projectId);
      if (ex) {
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

  const commitMilestoneDrag = () => {
    if (draggingMilestone) {
      const ex = exhibitions.find(p => p.id === draggingMilestone.projectId);
      if (ex) {
        const updatedMilestones = ex.milestones.map(m => m.id === draggingMilestone.milestoneId
          ? { ...m, date: draggingMilestone.tempDate }
          : m
        );
        handleUpdateExhibition({ ...ex, milestones: updatedMilestones });
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
        <div className="fixed inset-0 bg-slate-900/45 z-[110] backdrop-blur-sm flex items-center justify-center p-4 no-print" onClick={() => setShowPrintOptions(false)}>
          <div className="bg-white border border-slate-200 w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-slate-700" />
                <div>
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-900">Print options</h2>
                  <p className="text-[10px] text-slate-600 mt-0.5">Choose the audience, content, and explanatory detail for this printout.</p>
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

                <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900 leading-snug">
                  If the timeline needs to print below {Math.round(MIN_READABLE_PRINT_SCALE * 100)}% scale, shorten the date range or choose fewer lanes for a larger print.
                </div>
              </section>

              <section className="space-y-3">
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
                    Legends
                  </label>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 block mb-2">Visual appearance</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 border border-slate-200 px-2 py-2 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={printSettings.grayscale}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, grayscale: e.target.checked }))}
                      />
                      Grayscale mode
                    </label>
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
          ? exhibitions.find(p => p.id === selectedProjectId)
          : null;
        if (!selectedExhibition) return null;
        return (
          <>
            <div
              className="fixed inset-0 bg-slate-900/40 z-[90] no-print backdrop-blur-[2px]"
              onClick={() => setSelectedProjectId(null)}
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

      <main className="flex-1 flex flex-col min-w-0">
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
                  <span className="text-[11px] text-slate-600">Portfolio</span>
                </div>

                {/* Center: range + zoom + status pills */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 border border-slate-200 px-2 leading-none h-7">
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

                  <div className="w-px h-4 bg-slate-200" />

                  <div className="flex items-center gap-0.5" role="group" aria-label="Timeline span presets">
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
                      <span className="text-[11px]">{syncStatus === 'syncing' ? 'Syncing…' : 'Synced'}</span>
                      {syncStatus === 'syncing' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5" />
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
                      const isMilestone = defaultGallery.kind === 'permanent';
                      const newEx: Exhibition = {
                        id, exhibitionId: '', title: 'NEW PROJECT', status: 'TBC',
                        startDate: exStart, endDate: isMilestone ? exStart : exEnd, gallery: defaultGallery.name,
                        milestones: [], phases: phaseTypes.map(pt => ({
                          id: Math.random().toString(36).slice(2, 11), label: pt.label,
                          durationMonths: pt.isPost ? 1 : 3, typeId: pt.id
                        })), description: '',
                        isMilestone
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
                    <span>Project milestones: {printProjectMilestoneCount}</span>
                  </div>
                )}
                {printSettings.includeLegends && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] text-slate-600">
                    <span className="font-semibold uppercase tracking-[0.08em] text-slate-700">Legend</span>
                    {phaseTypes.map(type => (
                      <span key={type.id} className="inline-flex items-center gap-1">
                        <span className="w-3 h-1.5 border border-slate-400" style={{ background: type.color }} />
                        {type.label}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1"><Star size={9} className="text-amber-700 fill-amber-700" /> Permanent gallery</span>
                    <span className="inline-flex items-center gap-1"><Flag size={9} /> Milestone / event</span>
                  </div>
                )}
              </div>
              <div
                className="flex-1 overflow-auto timeline-root custom-scrollbar no-print-bg px-3 pb-3 print:overflow-visible relative"
                ref={timelineRef}
              >
                <div className="flex min-w-max h-max print:flex relative pt-2">
                  <aside 
                    data-print-sidebar 
                    className="sticky left-0 bg-white flex flex-col shrink-0 z-40 border-r border-slate-200 shadow-sm" 
                    style={{ width: `${SIDEBAR_WIDTH}px` }}
                  >
                    <div style={{ height: `${HEADER_HEIGHT}px` }} className="sticky top-0 z-[110] shrink-0 bg-white border-b border-slate-200 flex flex-col print:bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                      <div className="flex h-[22px] border-b border-slate-200 bg-white px-3 items-center">
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-[0.1em]">Timeline</span>
                      </div>
                      <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/60 px-3 items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.08em]">Fiscal Year</span>
                      </div>
                      <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/40 px-3 items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.08em]">Quarter</span>
                      </div>
                      <div className="flex h-[16px] bg-white px-3 items-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.08em]">Month</span>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1" ref={sidebarListRef}>
                  {portfolioGalleries.map((gallery) => {
                    const laneHeight = galleryLaneHeights[gallery.name] || BASE_LANE_HEIGHT;
                    const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === gallery.name);
                    const isPermanent = gallery.kind === 'permanent';
                    const isCollapsed = effectiveCollapsedGalleryIds.has(gallery.id);
                    // Match the timeline's location-milestone strip height so the
                    // gallery name has the same vertical space as the milestones it
                    // labels, and project tracks below it line up across both columns.
                    const headerHeight = mhFor(gallery.name);
                    if (isCollapsed) {
                      return (
                        <div
                          key={gallery.id}
                          style={{ height: `${laneHeight}px` }}
                          className={`relative border-b-2 border-slate-300 overflow-hidden flex items-center pl-4 pr-2.5 gap-1.5 ${isPermanent ? 'bg-amber-50/70' : 'bg-slate-50'} print:bg-white`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}`} />
                          <button
                            type="button"
                            aria-label={`Expand ${gallery.name}`}
                            onClick={() => toggleGalleryCollapsed(gallery.id)}
                            className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors no-print"
                          >
                            <ChevronRight size={12} strokeWidth={2.25} />
                          </button>
                          <span className="font-bold text-[13px] text-slate-900 truncate flex-1 uppercase tracking-[0.04em]" title={gallery.name}>{gallery.name}</span>
                          {isPermanent && (
                            <Star size={11} className="shrink-0 text-amber-600 fill-amber-600" strokeWidth={1.5} aria-label="Permanent gallery" />
                          )}
                          <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500 px-1.5 py-0.5 bg-white border border-slate-200">{galleryProjects.length}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={gallery.id} style={{ height: `${laneHeight}px` }} className={`relative border-b-2 border-slate-300 overflow-hidden ${isPermanent ? 'bg-amber-50/40' : 'bg-white'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-[3px] z-10 ${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}`} />
                        <div
                          style={{ height: `${headerHeight}px` }}
                          className={`absolute top-0 left-0 w-full border-b border-slate-300 flex items-center gap-1.5 pl-4 pr-2.5 z-20 ${isPermanent ? 'bg-amber-50' : 'bg-slate-50'} print:bg-white`}
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
                          <span className="font-bold text-[13px] text-slate-900 truncate flex-1 uppercase tracking-[0.04em]" title={gallery.name}>{gallery.name}</span>
                          {isPermanent && (
                            <Star size={11} className="shrink-0 text-amber-600 fill-amber-600" strokeWidth={1.5} aria-label="Permanent gallery" />
                          )}
                          <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500 px-1.5 py-0.5 bg-white border border-slate-200">{galleryProjects.length}</span>
                        </div>
                        {galleryProjects.map(ex => {
                          const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                          if (trackIndex === undefined) return null;
                          const layout = galleryTrackLayouts[gallery.name];
                          const trackTops = layout?.trackTops ?? [];
                          const trackTop = trackTops[trackIndex] ?? trackIndex * TRACK_HEIGHT;
                          // A project owns prePhases.length + 1 consecutive tracks. Position the title
                          // on the LAST allocated track (where the main bar lives), not the first
                          // (which holds the topmost pre-phase). This keeps the sidebar title aligned
                          // with the bar a viewer's eye lands on, mirroring the timeline layout.
                          const lastTrackIdx = getProjectLastAllocatedTrackIndex(ex, trackIndex, Math.max(1, trackTops.length));
                          const lastTrackTop = trackTops[lastTrackIdx] ?? trackTop;
                          // Mirror the timeline's project-bar Y offset: top strip +
                          // lane padding + track top. Without mhFor() the sidebar title
                          // floats above the timeline bar by ~28-48px.
                          const topPos = mhFor(gallery.name) + LANE_TOP_PADDING + lastTrackTop;
                          // Anchor the title text to the bar's exact vertical band so its
                          // visual centre matches the timeline bar's centre regardless of
                          // whether the ID line is present (a flex-justify-center stack
                          // would shift the title up when the ID is rendered).
                          const titleBandTop = topPos + (TRACK_HEIGHT - STANDARD_BAR_HEIGHT) / 2;
                          return (
                            <div
                              key={`title-${ex.id}`}
                              className="absolute flex items-center gap-1.5 overflow-hidden"
                              style={{ top: titleBandTop, height: `${STANDARD_BAR_HEIGHT}px`, left: '12px', right: '10px' }}
                            >
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[12px] font-medium text-slate-900 truncate leading-tight" title={ex.title}>{ex.title}</span>
                                  {(() => {
                                    const s = getStatusStyles(ex.status);
                                    return (
                                      <span 
                                        className="shrink-0 text-[7px] font-bold px-1 py-0.5 rounded-[2px] uppercase tracking-tighter border font-mono leading-none"
                                        style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
                                      >
                                        {ex.status === 'Open to Public' ? 'OPEN' : 
                                         ex.status === 'In Development' ? 'DEV' : 
                                         ex.status === 'TBC' ? 'TBC' : 'CLOSE'}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {isPrintMode && printSettings.showDescription && ex.description && (
                                  <span className="text-[9px] text-slate-600 italic truncate leading-tight mt-0.5" title={ex.description}>
                                    {ex.description}
                                  </span>
                                )}
                              </div>
                              {ex.exhibitionId && (
                                <span
                                  className="shrink-0 text-[9px] font-mono text-slate-500 leading-none whitespace-nowrap"
                                  title={ex.exhibitionId}
                                >
                                  {ex.exhibitionId}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {galleryProjects.map(ex => {
                          const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                          if (trackIndex === undefined || trackIndex === 0) return null;
                          const trackTop = galleryTrackLayouts[gallery.name]?.trackTops[trackIndex] ?? trackIndex * TRACK_HEIGHT;
                          return (
                            <div key={`side-div-${ex.id}`} className="absolute w-full border-t border-slate-200 left-0" style={{ top: mhFor(gallery.name) + LANE_TOP_PADDING + trackTop }} />
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
                onMouseDown={(e) => {
                  if (e.button === 0 && !longPressTimerRef.current && !draggingBarId && !draggingMilestone) {
                    setIsDraggingScroll(true);
                    startXRef.current = e.pageX - timelineRef.current!.offsetLeft;
                    scrollLeftRef.current = timelineRef.current!.scrollLeft;
                  }
                }}
                onMouseUp={() => {
                  setIsDraggingScroll(false);
                  if (draggingBarId && dragTempStartDate && dragTempEndDate) {
                    const ex = exhibitions.find(e => e.id === draggingBarId);
                    if (ex) {
                      handleUpdateExhibition({
                        ...ex,
                        startDate: dragTempStartDate,
                        endDate: dragTempEndDate
                      });
                    }
                  }
                  if (resizingEdge) commitResize();
                  if (resizingPhase) commitPhaseResize();
                  if (draggingMilestone) commitMilestoneDrag();
                  setDraggingBarId(null);
                  setDragTempStartDate(null);
                  setDragTempEndDate(null);
                  clearLongPress();
                }}
                onMouseLeave={() => {
                  setIsDraggingScroll(false);
                  if (draggingBarId && dragTempStartDate && dragTempEndDate) {
                    const ex = exhibitions.find(e => e.id === draggingBarId);
                    if (ex) {
                      handleUpdateExhibition({
                        ...ex,
                        startDate: dragTempStartDate,
                        endDate: dragTempEndDate
                      });
                    }
                  }
                  if (resizingEdge) commitResize();
                  if (resizingPhase) commitPhaseResize();
                  if (draggingMilestone) commitMilestoneDrag();
                  setDraggingBarId(null);
                  setDragTempStartDate(null);
                  setDragTempEndDate(null);
                  clearLongPress();
                }}
                onMouseMove={(e) => {
                  clearLongPress();

                  if (draggingMilestone) {
                    const deltaX = e.clientX - draggingMilestone.initialMouseX;
                    if (Math.abs(deltaX) > 2) suppressMilestoneClickRef.current = true;
                    const initialX = getPositionFromDate(draggingMilestone.initialDate, monthWidth, viewMonths);
                    let newDate = getDateFromPosition(initialX + deltaX, monthWidth, viewMonths);
                    if (showWeeklyGrid && !e.altKey) newDate = snapDate(newDate, 'week');
                    setDraggingMilestone(prev => prev ? { ...prev, tempDate: newDate } : prev);
                    return;
                  }

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
                      setDragTempStartDate(iso);
                      setDragTempEndDate(resizeInitialEndDateRef.current);
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
                      setDragTempStartDate(resizeInitialStartDateRef.current);
                      setDragTempEndDate(iso);
                    }
                    return;
                  }

                  if (resizingPhase) {
                    const deltaX = e.clientX - phaseResizeInitialMouseXRef.current;
                    const deltaMonths = deltaX / monthWidth;
                    // Snap to quarter-month (~weekly) granularity.
                    const raw = phaseResizeInitialDurationRef.current + deltaMonths;
                    const snapped = Math.max(0.25, Math.round(raw * 4) / 4);
                    setPhaseResizeTempDuration(snapped);
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

                    setDragTempStartDate(newStartDate);
                    setDragTempEndDate(newEndDate);
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

                  {activeMilestoneDragFeedback && (
                    <div className="absolute top-0 bottom-0 z-[76] pointer-events-none no-print" style={{ width: `${totalTimelineWidth}px` }}>
                      {/* Original Position Ghost */}
                      <div
                        className="absolute top-0 bottom-0 w-px border-l border-dashed border-slate-400 opacity-40"
                        style={{ left: `${getPositionFromDate(draggingMilestone?.initialDate || '', monthWidth, viewMonths)}px` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-amber-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85),0_0_16px_rgba(245,158,11,0.38)]"
                        style={{ left: `${activeMilestoneDragFeedback.x}px` }}
                      >
                        <div className="sticky top-[70px] -translate-x-1/2 rounded-sm border border-amber-700 bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-lg whitespace-nowrap">
                          Milestone {formatBarDate(activeMilestoneDragFeedback.date)}
                        </div>
                      </div>
                    </div>
                  )}

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
                      {yearBlocks.map(block => <div key={block.label} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center px-3 font-semibold text-[11px] tracking-[0.06em] text-slate-900 border-r border-slate-200 print:border-slate-400 print:text-black">{block.label}</div>)}
                    </div>
                     <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/60 relative z-10 print:bg-orange-50 print:border-orange-300">
                       {fyBlocks.map((block) => (
                         <div key={block.label} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center justify-start px-3 font-bold text-[9px] uppercase tracking-[0.08em] border-r border-slate-200 text-slate-700 print:text-orange-900">{block.label}</div>
                       ))}
                     </div>
                    <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/40 relative z-10 print:bg-slate-50 text-slate-700">
                      {fyQuarterBlocks.map((block, i) => <div key={`${block.label}-${i}`} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-200 text-[9px] font-bold tracking-[0.06em] text-slate-600 print:text-slate-900">{block.label}</div>)}
                    </div>
                    <div className="flex h-[16px] bg-white relative z-10 print:bg-white text-slate-600">
                      {viewMonths.map(m => <div key={`${m.year}-${m.month}`} style={{ width: `${monthWidth}px` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-200 text-[9px] font-semibold tracking-[0.04em] print:text-slate-900">{m.label}</div>)}
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
	                    <div className="flex flex-col">
	                      {filteredExhibitions.length === 0 && (
	                        <div className="absolute inset-0 flex items-center justify-center p-20 pointer-events-none z-0">
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
	                         const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === g);
	                         const isCollapsed = effectiveCollapsedGalleryIds.has(gallery.id);

	                         const isPermanent = gallery.kind === 'permanent';
	                         const headerStripHeight = mhFor(g);

                         if (isCollapsed) {
                           return (
                             <div
                               key={gallery.id}
                               style={{ height: `${laneHeight}px` }}
                               className="border-b-2 border-slate-300 relative overflow-hidden bg-white print:bg-slate-100 print:bg-none"
                             >
                               <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,#000_0px,#000_2px,transparent_2px,transparent_6px)]" />
                               <div className={`absolute left-0 top-0 bottom-0 w-[3px] z-10 ${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}`} />
                               
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
                                     <React.Fragment key={ex.id}>
                                       {/* Core Project Bar Preview */}
                                       <div 
                                         className="absolute h-2.5 rounded-full ring-1 ring-white/50"
                                         style={{ 
                                           left: `${startX}px`, 
                                           width: `${w}px`, 
                                           top: `${y}px`,
                                           backgroundColor: styles.barBg,
                                           opacity: 0.35
                                         }}
                                       />
                                       {/* Milestones for this project */}
                                       {(ex.milestones || []).map(m => {
                                         const mx = getPositionFromDate(m.date, monthWidth, viewMonths);
                                         return (
                                           <div 
                                             key={m.id}
                                             className="absolute w-2.5 h-2.5 rotate-45 border border-white/80 shadow-sm"
                                             style={{ 
                                               left: `${mx}px`, 
                                               top: `${y}px`, 
                                               backgroundColor: styles.barBg,
                                               transform: 'translate(-50%, -10%) rotate(45deg)',
                                               zIndex: 5
                                             }}
                                           />
                                         );
                                       })}
                                     </React.Fragment>
                                   );
                                 })}
                                 
                                 {/* Location Milestones Preview */}
                                 {locationMilestones
                                   .filter(lm => lm.gallery === g)
                                   .map(lm => {
                                     const lmx = getPositionFromDate(lm.date, monthWidth, viewMonths);
                                     return (
                                       <div 
                                         key={lm.id}
                                         className="absolute h-full w-px bg-slate-400/20"
                                         style={{ left: `${lmx}px`, top: 0 }}
                                       >
                                         <div 
                                           className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-400"
                                         />
                                       </div>
                                     );
                                   })
                                 }
                               </div>

                               {/* Tiny project count label */}
                               <div className="absolute right-2 bottom-1 text-[8px] font-bold text-slate-400 pointer-events-none uppercase tracking-tighter opacity-60">
                                 {galleryProjects.length} {galleryProjects.length === 1 ? 'project' : 'projects'}
                               </div>
                             </div>
                           );
                         }

                         return (
	                           <div key={gallery.id} style={{ height: `${laneHeight}px` }} className="border-b-2 border-slate-300 gallery-lane-bg relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.95)_100%)] print:bg-none print:bg-white">
	                             <div className={`absolute left-0 top-0 bottom-0 w-[3px] z-30 pointer-events-none ${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}`} />
	                             <div
	                               className={`absolute top-0 left-0 right-0 border-b border-slate-300 pointer-events-none ${isPermanent ? 'bg-amber-50/60' : 'bg-slate-50/80'} print:bg-white`}
	                               style={{ height: `${headerStripHeight}px`, zIndex: 5 }}
	                             />
                              {(() => {
                                const gMilestones = packMilestoneLabels<LocationMilestone & { xPos: number }>(
                                  locationMilestones
                                    .filter(m => m.gallery === g)
                                    .map(m => ({ ...m, xPos: getPositionFromDate(m.date, monthWidth, viewMonths) }))
                                ).items;
                                return gMilestones.map((m) => {
                                    return (
                                      <div 
                                        key={m.id} 
                                        className="absolute flex items-center justify-center pointer-events-auto"
                                        style={{ left: `${m.xPos}px`, top: `${MILESTONE_ICON_BAND_HEIGHT / 2}px`, transform: 'translate(-50%, -50%)' }}
                                      >
                                        <div
                                          className="transform hover:scale-125 transition-transform cursor-pointer flex items-center justify-center relative z-20"
                                          title={m.date}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditMilestoneDraft(m);
                                          }}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                        >
                                          {(() => {
                                            const c = m.color || '#dc2626';
                                            switch (m.icon) {
                                              case 'flag':
                                                return (
                                                  <div className="relative flex items-center justify-center pointer-events-none mt-1">
                                                    <Flag size={16} fill={c} stroke="black" strokeWidth={2} className="drop-shadow-[1px_1px_0_rgba(0,0,0,1)]" />
                                                  </div>
                                                );
                                              case 'team':
                                                return (
                                                  <div className="w-4 h-4 flex items-center justify-center rounded-full border-[1.5px] border-slate-900 shadow-[1px_1px_0_0_rgba(0,0,0,1)] pointer-events-none" style={{ backgroundColor: c }}>
                                                    <Users size={10} stroke="white" strokeWidth={2.5} />
                                                  </div>
                                                );
                                              case 'approval':
                                                return (
                                                  <div className="w-4 h-4 flex items-center justify-center pointer-events-none" style={{ filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,1))' }}>
                                                    <BadgeCheck size={16} fill={c} stroke="black" strokeWidth={2} />
                                                  </div>
                                                );
                                              case 'delivery':
                                                return (
                                                  <div className="px-1 py-0.5 flex items-center justify-center border-[1.5px] border-slate-900 shadow-[1px_1px_0_0_rgba(0,0,0,1)] pointer-events-none" style={{ backgroundColor: c }}>
                                                    <Truck size={10} stroke="white" strokeWidth={2.5} />
                                                  </div>
                                                );
                                              case 'event':
                                                return (
                                                  <div className="flex items-center justify-center pointer-events-none" style={{ filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,1))' }}>
                                                    <Star size={16} fill={c} stroke="black" strokeWidth={2} />
                                                  </div>
                                                );
                                              default:
                                                return (
                                                  <div className="w-3.5 h-3.5 bg-white border-[1.5px] border-slate-300 rotate-45 shadow-[1px_1px_0_0_rgba(0,0,0,1)] flex items-center justify-center pointer-events-none">
                                                    <div className="w-[4px] h-[4px]" style={{ backgroundColor: c }} />
                                                  </div>
                                                );
                                            }
                                          })()}
                                        </div>
                                        <div
                                          className={`absolute left-1/2 -translate-x-1/2 bg-white px-1.5 py-[3px] leading-none border border-slate-200 shadow-md opacity-95 transition-all hover:bg-slate-50 hover:opacity-100 z-30 pointer-events-none min-w-0 ${m.isTwoLine ? 'flex items-center justify-center' : 'inline-flex items-center gap-1.5'}`}
                                          style={{ top: `${MILESTONE_ICON_BAND_HEIGHT / 2 + 1 + (m.labelRow * MILESTONE_LABEL_ROW_HEIGHT)}px`, width: `${m.labelWidth}px`, maxWidth: `${MILESTONE_LABEL_MAX_WIDTH}px` }}
                                        >
                                          <MilestoneLabel
                                            title={m.title}
                                            date={m.date}
                                            labelFontSize={m.labelFontSize}
                                            dateFontSize={m.dateFontSize}
                                            isTwoLine={m.isTwoLine}
                                          />
                                        </div>
                                      </div>
                                  );
                                });
                              })()}

                              {galleryProjects.map(ex => {
                                const trackIndex = galleryLayouts[g]!.tracks[ex.id];
                                if (trackIndex === undefined || trackIndex === 0) return null;
                                const trackTop = galleryTrackLayouts[g]?.trackTops[trackIndex] ?? trackIndex * TRACK_HEIGHT;
                                return (
                                  <div key={`line-${ex.id}`} className="absolute w-full border-t-[1.5px] border-slate-300 z-10 pointer-events-none" style={{ top: mhFor(g) + LANE_TOP_PADDING + trackTop }} />
                                );
                              })}

                              {/* In-Lane Project Bars: Fixes print alignment and swimlane bleeding */}
                              <div className="absolute inset-0 pointer-events-none z-20">
                                {galleryProjects.map(ex => {
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
                                  const ownerTrackTop = trackTops[trackIndex] ?? trackIndex * TRACK_HEIGHT;
                                  const trackTop = mhFor(g) + LANE_TOP_PADDING + ownerTrackTop;
                                  const projectRowTop = (rowOffset: number) => {
                                    const absoluteTrackIndex = Math.min(trackIndex + rowOffset, maxTracks - 1);
                                    const fallback = ownerTrackTop + (rowOffset * TRACK_HEIGHT);
                                    return mhFor(g) + LANE_TOP_PADDING + (trackTops[absoluteTrackIndex] ?? fallback);
                                  };

                                  // When resizing a phase belonging to this project, swap in the temp duration
                                  // so the live layout reflects the in-progress drag.
                                  const isResizingPhaseHere = resizingPhase?.projectId === ex.id && phaseResizeTempDuration !== null;
                                  const phaseDurationFor = (p: ProjectPhase) =>
                                    isResizingPhaseHere && p.id === resizingPhase!.phaseId
                                      ? phaseResizeTempDuration!
                                      : p.durationMonths;
                                  const prePhasesRaw = (ex.phases || []).filter(p => !phaseTypes.find(t => t.id === p.typeId)?.isPost);
                                  const postPhasesRaw = (ex.phases || []).filter(p => phaseTypes.find(t => t.id === p.typeId)?.isPost);

                                  const totalPrePhaseWidthOnly = prePhasesRaw.reduce((acc, p) => acc + phaseDurationFor(p) * monthWidth, 0);
                                  const totalPreGaps = prePhasesRaw.length * PHASE_GAP;
                                  const totalPreWidth = totalPrePhaseWidthOnly + totalPreGaps;
                                  const phaseStartPos = startPos - totalPreWidth;
                                  
                                  let preOffset = 0;
                                  const renderedPre = prePhasesRaw.map((p, i) => {
                                    const pWidth = phaseDurationFor(p) * monthWidth;
                                    const pStart = phaseStartPos + preOffset;
                                    const pEnd = pStart + pWidth;
                                    const pY = projectRowTop(i) + (TRACK_HEIGHT - PHASE_BAR_HEIGHT) / 2;
                                    preOffset += pWidth + PHASE_GAP;
                                    return { ...p, startX: pStart, width: pWidth, endX: pEnd, y: pY, type: phaseTypes.find(t => t.id === p.typeId), i, isPost: false };
                                  });

                                  // Milestone projects have no main bar — the diamond replaces it.
                                  // Align it with the last pre-phase row so the dependency arrow flows straight into it
                                  // instead of dropping down to a wasted row below the phases.
                                  const mainBarY = ex.isMilestone && prePhasesRaw.length > 0
                                    ? projectRowTop(prePhasesRaw.length - 1) + (TRACK_HEIGHT - STANDARD_BAR_HEIGHT) / 2
                                    : projectRowTop(prePhasesRaw.length) + (TRACK_HEIGHT - STANDARD_BAR_HEIGHT) / 2;

                                  let postOffset = PHASE_GAP;
                                  const renderedPost = ex.isMilestone ? [] : postPhasesRaw.map((p, i) => {
                                    const pWidth = phaseDurationFor(p) * monthWidth;
                                    const pStart = endPos + postOffset;
                                    const pEnd = pStart + pWidth;
                                    const targetYIndex = prePhasesRaw.length > 0 ? prePhasesRaw.length - 1 : 0;
                                    const pY = projectRowTop(targetYIndex) + (TRACK_HEIGHT - PHASE_BAR_HEIGHT) / 2;
                                    postOffset += pWidth + PHASE_GAP;
                                    return { ...p, startX: pStart, width: pWidth, endX: pEnd, y: pY, type: phaseTypes.find(t => t.id === p.typeId), i: i, isPost: true };
                                  });

                                  const renderedPhases = [...renderedPre, ...renderedPost];

                                  return (
                                    <React.Fragment key={ex.id}>
                                      <div className={`absolute pointer-events-none transition-opacity duration-200 ${isDraggingThis ? 'opacity-30' : ''} ${isPrintMode && !printSettings.showPhases ? 'print:hidden' : ''}`}>
                                        {renderedPhases.map((phase, idx) => {
                                          const yCenter = phase.y + PHASE_BAR_HEIGHT / 2;
                                          let nextYCenter = -1;
                                          let nextX = -1;
                                          let hasNext = true;

                                          if (!phase.isPost) {
                                            const preIdx = idx;
                                            if (preIdx < renderedPre.length - 1) {
                                              nextYCenter = renderedPre[preIdx + 1].y + PHASE_BAR_HEIGHT / 2;
                                              nextX = renderedPre[preIdx + 1].startX;
                                            } else {
                                              nextYCenter = mainBarY + STANDARD_BAR_HEIGHT / 2;
                                              nextX = startPos;
                                            }
                                          } else {
                                            const postIdx = idx - renderedPre.length;
                                            if (postIdx < renderedPost.length - 1) {
                                              nextYCenter = renderedPost[postIdx + 1].y + PHASE_BAR_HEIGHT / 2;
                                              nextX = renderedPost[postIdx + 1].startX;
                                            } else {
                                              hasNext = false;
                                            }
                                          }

                                          return (
                                            <React.Fragment key={phase.id}>
                                              {phase.isPost ? (
                                                <div
                                                  className="absolute pointer-events-none text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-700 leading-none truncate print:text-slate-900 print:overflow-visible print:whitespace-nowrap"
                                                  style={{ left: `${phase.endX + 5}px`, top: `${phase.y + PHASE_BAR_HEIGHT / 2 - 5}px`, width: '110px' }}
                                                  title={phase.label}
                                                >
                                                  {phase.label}
                                                  {isPrintMode && (
                                                    <span className="ml-1 text-[8px] font-mono text-slate-400 font-normal">
                                                      ({formatBarDate(getDateFromPosition(phase.startX, monthWidth, viewMonths))} – {formatBarDate(getDateFromPosition(phase.endX, monthWidth, viewMonths))})
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <div
                                                  className="absolute pointer-events-none text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-700 leading-none truncate text-right print:text-slate-900 print:overflow-visible print:whitespace-nowrap"
                                                  style={{ left: `${phase.startX - 115}px`, top: `${phase.y + PHASE_BAR_HEIGHT / 2 - 5}px`, width: '110px' }}
                                                  title={phase.label}
                                                >
                                                  {isPrintMode && (
                                                    <span className="mr-1 text-[8px] font-mono text-slate-400 font-normal">
                                                      ({formatBarDate(getDateFromPosition(phase.startX, monthWidth, viewMonths))} – {formatBarDate(getDateFromPosition(phase.endX, monthWidth, viewMonths))})
                                                    </span>
                                                  )}
                                                  {phase.label}
                                                </div>
                                              )}
                                              <div
                                                className="absolute shadow-sm hover:shadow-md hover:opacity-90 transition-all pointer-events-auto border border-white/60 overflow-hidden"
                                                style={{ left: `${phase.startX}px`, top: `${phase.y}px`, width: `${Math.max(phase.width - 2, 0)}px`, height: `${PHASE_BAR_HEIGHT}px`, backgroundColor: phase.type?.color || '#eee' }}
                                                title={`${phase.label} — drag right edge to resize`}
                                              />
                                              <div
                                                aria-label={`Resize phase ${phase.label}`}
                                                className="absolute cursor-ew-resize pointer-events-auto hover:bg-slate-900/30 transition-colors no-print"
                                                style={{
                                                  left: `${phase.endX - EDGE_HIT_ZONE}px`,
                                                  top: `${phase.y}px`,
                                                  width: `${EDGE_HIT_ZONE}px`,
                                                  height: `${PHASE_BAR_HEIGHT}px`,
                                                  zIndex: 27
                                                }}
                                                onMouseDown={(e) => onPhaseHandleMouseDown(e, ex.id, phase as ProjectPhase)}
                                              />
                                              {hasNext && (
                                                <svg className="absolute overflow-visible pointer-events-none z-0" style={{ left: 0, top: 0, width: 1, height: 1 }}>
                                                  <path
                                                    d={nextYCenter === yCenter
                                                      ? `M ${phase.endX} ${yCenter} L ${nextX} ${nextYCenter}`
                                                      : `M ${phase.endX} ${yCenter} L ${phase.endX + 3} ${yCenter} L ${phase.endX + 3} ${nextYCenter} L ${nextX} ${nextYCenter}`
                                                    }
                                                    fill="none"
                                                    stroke="#cbd5e1"
                                                    strokeWidth="1"
                                                  />
                                                </svg>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}

                                        {renderedPost.length > 0 && (() => {
                                          const nX = renderedPost[0].startX;
                                          const nYCenter = renderedPost[0].y + PHASE_BAR_HEIGHT / 2;
                                          const curYCenter = mainBarY + STANDARD_BAR_HEIGHT / 2;
                                          return (
                                            <svg className="absolute overflow-visible pointer-events-none z-0" style={{ left: 0, top: 0, width: 1, height: 1 }}>
                                              <path
                                                d={nYCenter === curYCenter
                                                  ? `M ${endPos} ${curYCenter} L ${nX} ${nYCenter}`
                                                  : `M ${endPos} ${curYCenter} L ${endPos + 3} ${curYCenter} L ${endPos + 3} ${nYCenter} L ${nX} ${nYCenter}`
                                                }
                                                fill="none"
                                                stroke="#cbd5e1"
                                                strokeWidth="1"
                                              />
                                            </svg>
                                          );
                                        })()}
                                      </div>

                                      {ex.isMilestone ? (
                                        <div
                                          aria-label={`Project: ${ex.title} (${ex.status}). Completion milestone on ${formatBarDate(effStartDate)}. Click to view details.`}
                                          role="button"
                                          tabIndex={0}
                                          onMouseDown={(e) => onBarMouseDown(e, ex)}
                                          onClick={() => { if (!draggingBarId) setSelectedProjectId(ex.id); }}
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
                                        </div>
                                      ) : (
                                      <div
                                        aria-label={`Project: ${ex.title} (${ex.status}). Click to view details, long-press to drag.`}
                                        role="button"
                                        tabIndex={0}
                                        onMouseDown={(e) => onBarMouseDown(e, ex)}
                                        onClick={() => { if (!draggingBarId) setSelectedProjectId(ex.id); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProjectId(ex.id); }}
                                        className={`absolute pointer-events-auto shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/50 print:shadow-none ${isDraggingThis ? 'project-bar-dragging ring-2 ring-blue-500' : ''}`}
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
                                          <div className="flex-1 min-w-0 flex items-center pl-2.5 pr-1.5">
                                            <span 
                                              className="font-semibold text-[11px] truncate block leading-none"
                                              style={{ color: statusStyle.barText }}
                                            >
                                              {ex.title}
                                            </span>
                                          </div>
                                          {width >= 130 && (
                                            <span 
                                              className="shrink-0 font-mono font-bold text-[9px] pr-2.5 pl-1.5 leading-none whitespace-nowrap"
                                              style={{ color: statusStyle.barText }}
                                            >
                                              {formatBarDate(effStartDate)}–{formatBarDate(effEndDate)}
                                            </span>
                                          )}
                                          <div
                                            aria-label="Resize start date"
                                            className="absolute left-0 top-0 bottom-0 cursor-ew-resize hover:bg-white/30 transition-colors no-print"
                                            style={{ width: `${EDGE_HIT_ZONE}px`, zIndex: 27 }}
                                            onMouseDown={(e) => onEdgeMouseDown(e, ex, 'left')}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <div
                                            aria-label="Resize end date"
                                            className="absolute right-0 top-0 bottom-0 cursor-ew-resize hover:bg-white/30 transition-colors no-print"
                                            style={{ width: `${EDGE_HIT_ZONE}px`, zIndex: 27 }}
                                            onMouseDown={(e) => onEdgeMouseDown(e, ex, 'right')}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                      </div>
                                      )}

                                      {/* External title pill — renders just past the post-phases when the bar is too
                                          narrow to display the title legibly inside. Mirrors the milestone label style
                                          so narrow bars stay readable at any preset zoom level. */}
                                      {!ex.isMilestone && width < 80 && (() => {
                                        const lastPostEndX = renderedPost.length > 0
                                          ? renderedPost[renderedPost.length - 1].endX
                                          : endPos;
                                        return (
                                          <div
                                            className="absolute pointer-events-none whitespace-nowrap inline-flex items-center bg-white px-1.5 py-[3px] leading-none border border-slate-200 shadow-sm"
                                            style={{
                                              left: `${lastPostEndX + 6}px`,
                                              top: `${mainBarY + STANDARD_BAR_HEIGHT / 2}px`,
                                              transform: 'translateY(-50%)',
                                              zIndex: 24,
                                            }}
                                            title={ex.title}
                                          >
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-800">{ex.title}</span>
                                          </div>
                                        );
                                      })()}

                                      {/* Per-project milestones — rendered in a dynamically sized reserved
                                          band beneath the project track. Labels pack into as many rows as needed
                                          at the current zoom level instead of spilling into neighbouring tracks. */}
                                      {(ex.milestones || []).length > 0 && (() => {
                                        // Project occupies one track per pre-phase plus a main-bar track; post-phases
                                        // render on those allocated rows. Resolve through galleryTrackLayouts so a
                                        // milestone band always starts below the project's actual last allocated row.
                                        const lastAllocatedTrackIndex = getProjectLastAllocatedTrackIndex(ex, trackIndex, maxTracks);
                                        const lastAllocatedTrackTop = mhFor(g) + LANE_TOP_PADDING + (trackTops[lastAllocatedTrackIndex] ?? (ownerTrackTop + ((lastAllocatedTrackIndex - trackIndex) * TRACK_HEIGHT)));
                                        const bandTop = lastAllocatedTrackTop + TRACK_HEIGHT;
                                        const iconCenterY = bandTop + MILESTONE_ICON_BAND_HEIGHT / 2;

                                        const { items: projectMilestones } = packMilestoneLabels<ProjectMilestone & { xPos: number }>(
                                          (ex.milestones || []).map(pm => ({ ...pm, xPos: getPositionFromDate(pm.date, monthWidth, viewMonths) }))
                                        );

                                        return (
                                          <React.Fragment>
                                            {projectMilestones.map((pm) => {
                                              const isDraggingMilestone = draggingMilestone?.projectId === ex.id && draggingMilestone.milestoneId === pm.id;
                                              const effectiveMilestoneDate = isDraggingMilestone ? draggingMilestone.tempDate : pm.date;
                                              const effectiveMilestoneX = isDraggingMilestone
                                                ? getPositionFromDate(effectiveMilestoneDate, monthWidth, viewMonths)
                                                : pm.xPos;
                                              const c = pm.color || '#dc2626';
                                              const icon = pm.icon || 'diamond';
                                              return (
                                                <div
                                                  key={`pm-${pm.id}`}
                                                  className="absolute pointer-events-auto flex items-center justify-center"
                                                  style={{
                                                    left: `${effectiveMilestoneX}px`,
                                                    top: `${iconCenterY}px`,
                                                    transform: 'translate(-50%, -50%)',
                                                    zIndex: 28,
                                                  }}
                                                  onMouseDown={(e) => onMilestoneMouseDown(e, ex.id, pm)}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (suppressMilestoneClickRef.current) {
                                                      suppressMilestoneClickRef.current = false;
                                                      return;
                                                    }
                                                    setSelectedProjectId(ex.id);
                                                  }}
                                                  title={`${pm.title} — ${formatBarDate(effectiveMilestoneDate)}`}
                                                >
                                                  <div className="cursor-pointer relative z-10 flex items-center justify-center">
                                                    {(() => {
                                                      switch (icon) {
                                                        case 'flag':
                                                          return <Flag size={14} fill={c} stroke="black" strokeWidth={2} className="drop-shadow-[1px_1px_0_rgba(0,0,0,1)]" />;
                                                        case 'team':
                                                          return (
                                                            <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full border-[1.5px] border-slate-900 shadow-[1px_1px_0_0_rgba(0,0,0,1)]" style={{ backgroundColor: c }}>
                                                              <Users size={9} stroke="white" strokeWidth={2.5} />
                                                            </div>
                                                          );
                                                        case 'approval':
                                                          return <BadgeCheck size={14} fill={c} stroke="black" strokeWidth={2} style={{ filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,1))' }} />;
                                                        case 'delivery':
                                                          return (
                                                            <div className="px-1 py-0.5 flex items-center justify-center border-[1.5px] border-slate-900 shadow-[1px_1px_0_0_rgba(0,0,0,1)]" style={{ backgroundColor: c }}>
                                                              <Truck size={9} stroke="white" strokeWidth={2.5} />
                                                            </div>
                                                          );
                                                        case 'event':
                                                          return <Star size={14} fill={c} stroke="black" strokeWidth={2} style={{ filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,1))' }} />;
                                                        default:
                                                          return (
                                                            <div className="w-3.5 h-3.5 bg-white border-[1.5px] border-slate-300 rotate-45 shadow-[1px_1px_0_0_rgba(0,0,0,1)] flex items-center justify-center">
                                                              <div className="w-[4px] h-[4px]" style={{ backgroundColor: c }} />
                                                            </div>
                                                          );
                                                      }
                                                    })()}
                                                  </div>
                                                  <div
                                                    className={`absolute left-1/2 -translate-x-1/2 bg-white px-1.5 py-[3px] leading-none border border-slate-200 shadow-sm opacity-95 hover:bg-slate-50 hover:opacity-100 transition-all z-20 min-w-0 ${pm.isTwoLine ? 'flex items-center justify-center' : 'inline-flex items-center gap-1.5'}`}
                                                    style={{ top: `${MILESTONE_ICON_BAND_HEIGHT / 2 + 1 + (pm.labelRow * MILESTONE_LABEL_ROW_HEIGHT)}px`, width: `${pm.labelWidth}px`, maxWidth: `${MILESTONE_LABEL_MAX_WIDTH}px` }}
                                                  >
                                                    <MilestoneLabel
                                                      title={pm.title}
                                                      date={effectiveMilestoneDate}
                                                      labelFontSize={pm.labelFontSize}
                                                      dateFontSize={pm.dateFontSize}
                                                      isTwoLine={pm.isTwoLine}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </React.Fragment>
                                        );
                                      })()}

                                    </React.Fragment>
                                  );
                                })}
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
                      const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === gallery.name);
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
                                              <span className="font-bold">{phaseTypes.find(t => t.id === p.typeId)?.label || p.label}:</span>
                                              <span className="ml-1 text-slate-400">{p.durationMonths}m</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {(ex.milestones || []).length > 0 && (
                                        <div className="bg-slate-50 p-2 border border-slate-100 rounded-sm">
                                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Key Milestones</div>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            {ex.milestones?.map(m => (
                                              <div key={m.id} className="flex justify-between items-baseline gap-2">
                                                <span className="text-[9px] text-slate-700 truncate">{m.label}</span>
                                                <span className="text-[8px] font-mono text-slate-400 shrink-0">{formatBarDate(m.date)}</span>
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
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 no-print">
            <div className="max-w-3xl mx-auto px-5 py-5 space-y-5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:bg-white border border-slate-200 bg-white px-2 py-1 leading-none transition-colors"
                >
                  <ArrowLeft size={11} /> Back
                </button>
                <h2 className="text-[12px] font-semibold uppercase tracking-tight text-slate-700">Settings</h2>
              </div>

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

              <section className="border border-slate-200 bg-white p-3 space-y-2">
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
        )}
      </main>

      {activeTab === 'portfolio' && (
        <footer className="shrink-0 h-6 bg-white border-t border-slate-200 flex items-center justify-between px-3 text-[10px] text-slate-600 leading-none print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? (syncStatus === 'syncing' ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-slate-300'}`} />
              <span>{currentUser ? (syncStatus === 'syncing' ? 'Syncing' : 'Synced') : 'Local only'}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span><span className="font-mono text-slate-600">{filteredExhibitions.length}</span> projects</span>
            <span className="text-slate-300">·</span>
            <span><span className="font-mono text-slate-600">{galleries.length}</span> galleries</span>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-4">
              {ALL_STATUSES.map(s => {
                const sty = getStatusStyles(s);
                return (
                  <div key={s} className="flex items-center gap-1.5 opacity-80">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sty.barBg }} />
                    <span className="uppercase tracking-wide font-medium text-[9px]">{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Long-press a bar to drag</span>
            <span className="text-slate-300 hidden md:inline">·</span>
            <span className="hidden md:inline">Drag bar edges to resize</span>
            <span className="text-slate-300 hidden md:inline">·</span>
            <span className="font-mono text-slate-500">PortfolioTool v2</span>
          </div>
        </footer>
      )}
    </div>
  );
}

