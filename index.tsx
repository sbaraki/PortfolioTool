import { useStore } from './src/store/useStore';
import { useMuseumSync } from './src/hooks/useMuseumSync';
import { useMuseumActions } from './src/hooks/useMuseumActions';
import { getStatusStyles, MONTHS, FY_QUARTERS, BASE_LANE_HEIGHT, TRACK_HEIGHT, HEADER_HEIGHT, STANDARD_BAR_HEIGHT, PHASE_BAR_HEIGHT, MILESTONE_COLORS, MILESTONE_ROW_HEIGHT, LANE_BOTTOM_PADDING, PHASE_GAP } from './src/constants';
import { toISODate, getPositionFromDate, getDateFromPosition, formatBarDate, getDateWithMonthDuration, getDurationDays } from './src/lib/dateUtils';
import { calculateTracks } from './src/lib/layoutEngine';
import { Exhibition, Gallery, GalleryKind, PhaseType, LocationMilestone, ProjectPhase, ExhibitionStatus } from './src/types';
import { DetailPanel } from './src/components/DetailPanel';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';
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
  Filter,
  Search,
  MoreVertical,
  GripVertical,
  Flag,
  AlertTriangle,
  LogOut,
  LogIn,
  Cloud,
  CloudOff,
  History,
  Globe,
  Hammer,
  CircleDashed,
  Lock,
  HelpCircle
} from 'lucide-react';

import { GithubAuthModal } from './src/components/GithubAuthModal';

// --- Components ---
const StatusIcon = ({ status, size = 12, className = "" }: { status: string; size?: number; className?: string }) => {
  const styles = getStatusStyles(status);
  const iconName = styles.icon;
  
  switch (iconName) {
    case 'globe': return <Globe size={size} className={className} />;
    case 'hammer': return <Hammer size={size} className={className} />;
    case 'circle-dashed': return <CircleDashed size={size} className={className} />;
    case 'lock': return <Lock size={size} className={className} />;
    default: return <HelpCircle size={size} className={className} />;
  }
};


// --- Main App ---

export default function MasterScheduler() {
  const SIDEBAR_WIDTH = 176;
  const PRINT_SAFE_WIDTH = 1540;
  const PRINT_SAFE_HEIGHT = 980;
  const { currentUser, syncStatus, setSyncStatus, isInitialLoad } = useMuseumSync();
  const { 
    museumName, setMuseumName,
    galleries, setGalleries,
    phaseTypes, setPhaseTypes,
    exhibitions, setExhibitions,
    locationMilestones, setLocationMilestones,
    monthWidth, setMonthWidth,
    timelineStartDate, setTimelineStartDate,
    timelineEndDate, setTimelineEndDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    showConflicts, setShowConflicts
  } = useStore();
  const { handleUpdateExhibition, handleRemoveExhibition, handleRenameGallery, handleSetGalleryKind, handleAddGallery, handleRemoveGallery, handleDuplicateProject } = useMuseumActions();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'settings'>('portfolio');
  const [showGithubAuth, setShowGithubAuth] = useState(false);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  
  const [draggingBarId, setDraggingBarId] = useState<string | null>(null);
  const [dragStartMouseX, setDragStartMouseX] = useState(0);
  const [dragStartProjectX, setDragStartProjectX] = useState(0);
  const [dragDurationDays, setDragDurationDays] = useState(0);
  const [dragTempStartDate, setDragTempStartDate] = useState<string | null>(null);
  const [dragTempEndDate, setDragTempEndDate] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarListRef = useRef<HTMLDivElement>(null);

  const [editMilestoneDraft, setEditMilestoneDraft] = useState<LocationMilestone | null>(null);

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

  const filteredExhibitions = useMemo(() => {
    return exhibitions.filter(ex => {
      const matchesSearch = ex.title.toUpperCase().includes(searchQuery.toUpperCase()) || 
                           (ex.exhibitionId || '').toUpperCase().includes(searchQuery.toUpperCase());
      const matchesStatus = statusFilter === 'All' || ex.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [exhibitions, searchQuery, statusFilter]);

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
    galleries.forEach(gallery => {
      const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === gallery.name);
      const layoutInfo = calculateTracks(galleryProjects, monthWidth, viewMonths, phaseTypes);
      layouts[gallery.name] = { tracks: layoutInfo.tracks, maxTracks: layoutInfo.maxTracks };
    });
    return layouts;
  }, [filteredExhibitions, galleries, monthWidth, viewMonths, phaseTypes]);

  const galleryLaneHeights = useMemo(() => {
    return galleries.reduce((acc, gallery) => {
      const tracksCount = galleryLayouts[gallery.name]?.maxTracks || 1;
      acc[gallery.name] = Math.max(
        BASE_LANE_HEIGHT,
        MILESTONE_ROW_HEIGHT + tracksCount * TRACK_HEIGHT + LANE_BOTTOM_PADDING
      );
      return acc;
    }, {} as Record<string, number>);
  }, [galleries, galleryLayouts]);

  const totalTimelineWidth = viewMonths.length * monthWidth;
  const totalTimelineHeight = useMemo(() => {
    const galleryHeight = galleries.reduce((sum, gallery) => sum + (galleryLaneHeights[gallery.name] || BASE_LANE_HEIGHT), 0);
    return HEADER_HEIGHT + galleryHeight + 72;
  }, [galleries, galleryLaneHeights]);

  const printScale = useMemo(() => {
    const widthScale = PRINT_SAFE_WIDTH / (SIDEBAR_WIDTH + totalTimelineWidth);
    const heightScale = PRINT_SAFE_HEIGHT / totalTimelineHeight;
    return Math.min(1, widthScale, heightScale);
  }, [SIDEBAR_WIDTH, totalTimelineHeight, totalTimelineWidth]);

  const todayPos = useMemo(() => {
    return getPositionFromDate(toISODate(new Date()), monthWidth, viewMonths);
  }, [monthWidth, viewMonths]);

  const onBarMouseDown = (e: React.MouseEvent, project: Exhibition) => {
    if (e.button !== 0) return;
    const projectX = getPositionFromDate(project.startDate, monthWidth, viewMonths);
    const durationDays = getDurationDays(project.startDate, project.endDate);
    const mouseX = e.clientX;

    longPressTimerRef.current = window.setTimeout(() => {
      setDraggingBarId(project.id);
      setDragStartMouseX(mouseX);
      setDragStartProjectX(projectX);
      setDragDurationDays(durationDays);
    }, 400);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div
      className={`min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#f8fafc_28%,#eef2f7_100%)] text-black flex flex-col font-sans overflow-hidden select-none antialiased ${draggingBarId ? 'cursor-grabbing' : ''}`}
      style={{ ['--print-scale' as string]: `${printScale}` }}
    >
      {showGithubAuth && <GithubAuthModal onClose={() => setShowGithubAuth(false)} />}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-left: 1px solid #cbd5e1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
        .is-grabbing { cursor: grabbing !important; }
        
        .timeline-container {
          outline: none;
        }

        input[type="range"] {
          -webkit-appearance: none;
          background: #e2e8f0;
          height: 4px;
          border-radius: 2px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 8px;
          background: #000;
          border: 1px solid #000;
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scaleY(1.2);
        }
        
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid black;
          outline-offset: 2px;
        }

        .project-bar-dragging {
          opacity: 0.6 !important;
          z-index: 100 !important;
          cursor: grabbing !important;
          box-shadow: 6px 6px 0 0 rgba(0,0,0,1) !important;
          transform: translateY(-2px) !important;
        }

        .gallery-lane-bg {
          background-color: transparent;
          transition: background-color 0.2s ease;
        }
        .gallery-lane-bg:nth-child(even) {
          background-color: rgba(248,250,252,0.6);
        }
        .gallery-lane-bg:hover {
          background-color: rgba(241,245,249,0.8);
        }
      `}</style>
      
      {editMilestoneDraft && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditMilestoneDraft(null)}>
          <div className="bg-white border border-black/10 w-full max-w-sm shadow-xl rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 text-white px-4 py-3 font-semibold tracking-widest flex justify-between items-center text-[12px]">
              <span>EDIT MILESTONE</span>
              <button aria-label="Close" onClick={() => setEditMilestoneDraft(null)} className="hover:text-red-400 transition-colors">
                <X size={14} strokeWidth={3} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700">Milestone Title</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 p-3 font-semibold uppercase text-sm outline-none focus:bg-slate-50 transition-colors" 
                  value={editMilestoneDraft.title} 
                  onChange={(e) => setEditMilestoneDraft({ ...editMilestoneDraft, title: e.target.value.toUpperCase() })} 
                  autoFocus 
                  placeholder="E.G. BOARD MEETING"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700">Date</label>
                <input 
                  type="date" 
                  className="w-full border border-slate-300 p-3 font-medium uppercase text-sm outline-none focus:bg-slate-50 transition-colors" 
                  value={editMilestoneDraft.date} 
                  onChange={(e) => setEditMilestoneDraft({ ...editMilestoneDraft, date: e.target.value })} 
                />
              </div>
              
              <div className="space-y-4">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700">Milestone Icon & Color</label>
                <div className="flex gap-4 mb-4">
                  <button 
                    onClick={() => setEditMilestoneDraft({ ...editMilestoneDraft, icon: 'diamond' })}
                    className={`flex items-center space-x-2 px-4 py-2 border-2 transition-colors ${editMilestoneDraft.icon !== 'flag' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="w-3 h-3 bg-white border border-slate-300 rotate-45" />
                    <span className="text-[12px] font-medium uppercase">Diamond</span>
                  </button>
                  <button 
                    onClick={() => setEditMilestoneDraft({ ...editMilestoneDraft, icon: 'flag' })}
                    className={`flex items-center space-x-2 px-4 py-2 border-2 transition-colors ${editMilestoneDraft.icon === 'flag' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <Flag size={14} fill="white" stroke="black" strokeWidth={2} />
                    <span className="text-[12px] font-medium uppercase">Flag</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {MILESTONE_COLORS.map(c => (
                    <button 
                      key={c.value}
                      onClick={() => setEditMilestoneDraft({ ...editMilestoneDraft, color: c.value })}
                      className={`flex items-center space-x-2 px-3 py-1.5 border-2 hover:bg-slate-50 transition-colors ${editMilestoneDraft.color === c.value || (!editMilestoneDraft.color && c.value === '#dc2626') ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200'}`}
                    >
                      <div className="w-3 h-3 border border-slate-300" style={{ backgroundColor: c.value }} />
                      <span className="text-[10px] font-medium tracking-widest uppercase">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t border-slate-200/10 mt-6">
                <button 
                  onClick={async () => {
                    const idToRemove = editMilestoneDraft.id;
                    setLocationMilestones(prev => prev.filter(m => m.id !== idToRemove));
                    setEditMilestoneDraft(null);
                    if (currentUser) {
                      try {
                        setSyncStatus('syncing');
                        // Handled by useMuseumSync auto-save
                        setSyncStatus('synced');
                      } catch (err) {
                        setSyncStatus('error');
                      }
                    }
                  }} 
                  className="text-red-600 font-semibold text-[12px] uppercase tracking-widest hover:underline flex items-center"
                >
                  <Trash2 size={12} className="mr-1.5" strokeWidth={3} /> DELETE
                </button>
                <button 
                  onClick={async () => {
                    if (editMilestoneDraft.title.trim() === '') {
                      const idToRemove = editMilestoneDraft.id;
                      setLocationMilestones(prev => prev.filter(m => m.id !== idToRemove));
                      if (currentUser) {
                        try {
                          setSyncStatus('syncing');
                          // Handled by useMuseumSync auto-save
                          setSyncStatus('synced');
                        } catch (err) {
                          setSyncStatus('error');
                        }
                      }
                    } else {
                      setLocationMilestones(prev => prev.map(m => m.id === editMilestoneDraft.id ? editMilestoneDraft : m));
                      if (currentUser) {
                        try {
                          setSyncStatus('syncing');
                          // No-op for now: handled by useMuseumSync auto-save
                          setSyncStatus('synced');
                        } catch (err) {
                          setSyncStatus('error');
                        }
                      }
                    }
                    setEditMilestoneDraft(null);
                  }} 
                  className="bg-slate-900 text-white px-6 py-2.5 border border-slate-300 font-medium uppercase text-[12px] tracking-widest hover:bg-slate-800 transition-colors shadow-sm active:scale-95"
                >
                  SAVE OVERRIDE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProjectId && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 z-[90] no-print backdrop-blur-[2px]" 
            onClick={() => setSelectedProjectId(null)} 
          />
          <DetailPanel 
            key={selectedProjectId}
            exhibition={exhibitions.find(p => p.id === selectedProjectId)!} 
            onClose={() => setSelectedProjectId(null)} 
            onUpdate={handleUpdateExhibition} 
            onDelete={async (id) => {
              const beforeCount = useStore.getState().exhibitions.length;
              await handleRemoveExhibition(id);
              if (useStore.getState().exhibitions.length < beforeCount) {
                setSelectedProjectId(null);
              }
            }}
            onDuplicate={handleDuplicateProject}
            galleries={galleries}
            phaseTypes={phaseTypes}
          />
        </AnimatePresence>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {activeTab === 'portfolio' ? (
          <>
            <header className="bg-white border-b border-slate-200 z-50 shrink-0 print:hidden">
	      <nav className="px-4 py-2 flex items-center justify-between gap-4">
                {/* Left: Brand & Search */}
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col min-w-[140px]">
                    <h1 className="text-[11px] font-bold tracking-[0.12em] uppercase leading-none text-slate-900 truncate">{museumName}</h1>
                    
                  </div>

                  <div className="flex items-center no-print border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="relative border-r border-slate-100 group">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors" />
                      <input 
                        className="h-7 pl-8 pr-3 bg-white text-[11px] font-medium uppercase outline-none focus:bg-slate-50/50 transition-all w-[140px]"
                        placeholder="SEARCH..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center px-1 bg-slate-50/50">
                      <Filter size={10} className="text-slate-400 ml-1" />
                      <select 
                        className="bg-transparent border-none outline-none text-[10px] font-bold uppercase cursor-pointer px-1 pr-4 h-7"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                      >
                        <option value="All">ALL STATUS</option>
                        <option value="Proposed">PROPOSED</option>
                        <option value="In Development">IN DEV</option>
                        <option value="Open to Public">OPEN</option>
                        <option value="Closed">CLOSED</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Center: View Controls */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 border border-slate-200 bg-white px-2 py-1 shadow-sm">
                    <input aria-label="Start" type="date" value={timelineStartDate} onChange={(e) => setTimelineStartDate(e.target.value)} className="bg-transparent text-[10px] font-bold uppercase outline-none w-[95px] h-5" />
                    <span className="text-slate-300 font-bold">-</span>
                    <input aria-label="End" type="date" value={timelineEndDate} onChange={(e) => setTimelineEndDate(e.target.value)} className="bg-transparent text-[10px] font-bold uppercase outline-none w-[95px] h-5" />
                    <select aria-label="Presets" onChange={(e) => applyPreset(parseInt(e.target.value))} className="bg-transparent text-[10px] font-bold uppercase outline-none ml-1 border-l border-slate-200 pl-1 cursor-pointer h-5">
                      <option value="3">PRESETS</option>
                      <option value="1">1 YEAR</option>
                      <option value="2">2 YEARS</option>
                      <option value="3">3 YEARS</option>
                      <option value="4">4 YEARS</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button 
                      aria-label="Zoom out"
                      onClick={() => setMonthWidth(prev => Math.max(24, prev - 20))} 
                      className="p-1.5 hover:bg-slate-50 border-r border-slate-100 transition-colors text-slate-500"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <button 
                      aria-label="Zoom in"
                      onClick={() => setMonthWidth(prev => Math.min(300, prev + 20))} 
                      className="p-1.5 hover:bg-slate-50 transition-colors text-slate-500"
                    >
                      <ZoomIn size={13} />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1 ml-1">
                    <button
                      onClick={() => setShowConflicts(!showConflicts)}
                      className={`p-1.5 border shadow-sm transition-colors ${showConflicts ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-400'}`}
                      title="Conflicts"
                    >
                      <AlertTriangle size={13} />
                    </button>
                  </div>
                </div>

                {/* Right: User & Actions */}
                <div className="flex items-center space-x-3">
                  {currentUser && (
                    <div className="flex items-center space-x-2 border-r border-slate-200 pr-3 mr-1">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase leading-none text-slate-800">{currentUser.displayName || 'Me'}</span>
                        <span className="text-[8px] font-medium text-slate-500 leading-none mt-0.5 truncate max-w-[80px]">{currentUser.email}</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (window.confirm('Sign out?')) {
                            localStorage.removeItem('github_pat');
                            localStorage.removeItem('github_gist_id');
                            window.location.reload();
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <LogOut size={12} />
                      </button>
                    </div>
                  )}

                  {!currentUser && (
                    <button 
                      onClick={() => setShowGithubAuth(true)}
                      className="group relative px-2.5 py-1.5 bg-white border border-slate-300 font-bold uppercase text-[9px] hover:bg-slate-50 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 overflow-hidden"
                    >
                      <motion.div 
                        className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={false}
                      />
                      <LogIn size={11} className="relative z-10" /> 
                      <span className="relative z-10">SYNC</span>
                      {syncStatus === 'syncing' && (
                        <motion.div 
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1"
                        />
                      )}
                    </button>
                  )}

                  <div className="flex items-center space-x-1.5">
                    <button 
                      onClick={() => window.print()} 
                      className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                      title="Print"
                    >
                      <Printer size={13} />
                    </button>
                    <button 
                      onClick={() => setActiveTab('settings')} 
                      className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                      title="Settings"
                    >
                      <Settings size={13} />
                    </button>
                    <button 
                      onClick={async () => {
                        const id = Math.random().toString(36).substr(2,9);
                        const now = new Date();
                        const exStart = getDateWithMonthDuration(toISODate(now), 12);
                        const exEnd = getDateWithMonthDuration(exStart, 3);
                        const newEx: Exhibition = { 
                          id, exhibitionId: '', title: 'NEW PROJECT', status: 'Proposed', 
                          startDate: exStart, endDate: exEnd, gallery: galleries[0]?.name || '',
                          milestones: [], phases: phaseTypes.map(pt => ({
                            id: Math.random().toString(36).substr(2,9), label: pt.label,
                            durationMonths: pt.isPost ? 1 : 3, typeId: pt.id
                          })), description: '' 
                        };
                        setExhibitions([...exhibitions, newEx]);
                        setSelectedProjectId(id);
                      }} 
                      className="px-3 py-1.5 bg-slate-900 text-white font-bold uppercase text-[10px] hover:bg-slate-800 transition-colors flex items-center shadow-sm"
                    >
                      <Plus size={11} className="mr-1" strokeWidth={3} /> NEW PROJECT
                    </button>
                  </div>
                </div>
              </nav>
            </header>

            <div className="flex-1 flex overflow-hidden timeline-root no-print-bg px-3 pb-3 pt-2 gap-3">
	              <aside className="bg-white flex flex-col shrink-0 z-40 border-r border-slate-200 shadow-sm" style={{ width: `${SIDEBAR_WIDTH}px` }}>
	                <div style={{ height: `${HEADER_HEIGHT}px` }} className="shrink-0 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] border-b border-slate-200 flex flex-col justify-center px-5 gap-1.5">
	                  {(['Proposed', 'In Development', 'Open to Public', 'Closed'] as const).map(s => {
	                    return (
	                      <div key={s} className="flex items-center gap-2.5">
	                        <StatusIcon status={s} size={11} className="text-slate-500 shrink-0" />
	                        <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-600 leading-none">{s}</span>
	                      </div>
	                    );
	                  })}
	                </div>
	                <div
	                  className="flex-1 overflow-y-auto custom-scrollbar"
	                  ref={sidebarListRef}
	                  onScroll={(e) => {
	                    if (timelineRef.current && timelineRef.current.scrollTop !== e.currentTarget.scrollTop) {
	                      timelineRef.current.scrollTop = e.currentTarget.scrollTop;
	                    }
	                  }}
	                >
	                  {galleries.map((gallery) => {
	                    const laneHeight = galleryLaneHeights[gallery.name] || BASE_LANE_HEIGHT;
	                    const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === gallery.name);
	                    const isPermanent = gallery.kind === 'permanent';
	                    return (
		                      <div key={gallery.id} style={{ height: `${laneHeight}px` }} className="relative border-b border-black/10 bg-white/80 overflow-hidden">
		                        <div
		                          style={{ minHeight: `${MILESTONE_ROW_HEIGHT}px` }}
		                          className={`absolute top-0 left-0 w-full border-b border-slate-300 flex items-center justify-between px-4 py-3 z-20 print:bg-slate-50 border-l-4 ${isPermanent ? 'bg-amber-50/80 border-l-amber-700' : 'bg-slate-100/90 border-l-slate-800'}`}
		                          title={isPermanent ? 'Permanent gallery space' : 'Temporary exhibition space'}
		                        >
		                          <span className="font-bold uppercase text-[10px] tracking-[0.18em] text-slate-900 leading-tight line-clamp-2 pr-2">{gallery.name}</span>
		                          {isPermanent && (
		                            <span className="shrink-0 text-[7.5px] font-bold uppercase tracking-[0.14em] border border-amber-700/60 bg-white text-amber-800 px-1 py-[1px] rounded-sm">PERM</span>
		                          )}
		                        </div>
                        {galleryProjects.map(ex => {
                          const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                          if (trackIndex === undefined) return null;
                          const topPos = MILESTONE_ROW_HEIGHT + (trackIndex * TRACK_HEIGHT);
                          const titleMaxHeight = Math.max(0, TRACK_HEIGHT - 6);
                          return (
                            <div
                              key={`title-${ex.id}`}
                              className="absolute left-4 w-[calc(100%-1rem)] pr-2 overflow-hidden"
                              style={{ top: topPos + 4, maxHeight: `${titleMaxHeight}px` }}
                            >
                              <div className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2 underline-offset-2" title={ex.title}>{ex.title}</div>
                              {ex.exhibitionId && (
                                <div className="text-[10px] font-bold text-slate-700 mt-0 uppercase tracking-tight truncate">
                                  {ex.exhibitionId}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {galleryProjects.map(ex => {
                          const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                          if (trackIndex === undefined || trackIndex === 0) return null;
                          return (
                            <div key={`side-div-${ex.id}`} className="absolute w-full border-t-[1.5px] border-slate-200 left-0" style={{ top: MILESTONE_ROW_HEIGHT + trackIndex * TRACK_HEIGHT }} />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </aside>
              
		              <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-50 border border-slate-200 shadow-none">

                <div 
                  tabIndex={0}
                  className={`flex-1 overflow-auto relative bg-white custom-scrollbar timeline-container cursor-grab active:cursor-grabbing ${isDraggingScroll ? '!cursor-grabbing' : ''}`} 
                  ref={timelineRef} 
                  onScroll={(e) => {
                    if (sidebarListRef.current && sidebarListRef.current.scrollTop !== e.currentTarget.scrollTop) {
                      sidebarListRef.current.scrollTop = e.currentTarget.scrollTop;
                    }
                  }}
                  onMouseDown={(e) => { 
                  if (e.button === 0 && !longPressTimerRef.current && !draggingBarId) { 
                    setIsDraggingScroll(true); 
                    setStartX(e.pageX - timelineRef.current!.offsetLeft); 
                    setScrollLeftState(timelineRef.current!.scrollLeft); 
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
                  setDraggingBarId(null);
                  setDragTempStartDate(null);
                  setDragTempEndDate(null);
                  clearLongPress();
                }}
                onMouseMove={(e) => {
                  clearLongPress();
                  
	                  if (draggingBarId) {
	                    const deltaX = e.clientX - dragStartMouseX;
	                    const newProjectX = dragStartProjectX + deltaX;
	                    const newStartDate = getDateFromPosition(newProjectX, monthWidth, viewMonths);
	                    const start = new Date(newStartDate + 'T12:00:00');
	                    const draggedEnd = new Date(start);
	                    draggedEnd.setDate(draggedEnd.getDate() + dragDurationDays);
	                    const newEndDate = toISODate(draggedEnd);
                    
                    setDragTempStartDate(newStartDate);
                    setDragTempEndDate(newEndDate);
                    return;
                  }

                  if (!isDraggingScroll || !timelineRef.current) return;
                  const x = e.pageX - timelineRef.current.offsetLeft;
                  timelineRef.current.scrollLeft = scrollLeftState - (x - startX) * 1.5;
	                }}
	              >
	                <div className="inline-flex flex-col relative min-h-full">
	                  {/* Now Indicator */}
                  <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-[70] pointer-events-none" style={{ left: `${todayPos}px` }}>
                    <div className="sticky top-[6px] bg-red-600 text-white font-semibold text-[10px] px-1.5 py-0.5 uppercase transform -translate-x-1/2 shadow-sm w-max whitespace-nowrap">TODAY</div>
                  </div>

                  {/* Header */}
                  <div className="sticky top-0 z-[60] border-b border-black/10 flex flex-col overflow-hidden shadow-sm" style={{ height: `${HEADER_HEIGHT}px` }}>
                    <div className="flex h-[30px] border-b border-black/10 bg-white relative z-10 print:bg-white print:border-slate-400">
                      {yearBlocks.map(block => <div key={block.label} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center px-4 font-bold text-base tracking-[0.1em] text-slate-900 border-r border-black/10 print:border-slate-400 print:text-black">{block.label}</div>)}
                    </div>
                     <div className="flex h-[24px] border-b border-slate-300 bg-slate-50 relative z-10 print:bg-orange-100 print:border-orange-300 print:text-orange-900">
                       {fyBlocks.map((block) => (
                         <div key={block.label} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center justify-start px-4 font-bold text-[9px] uppercase tracking-wider border-r border-black/10 text-slate-700 print:border-orange-300 print:text-orange-900">{block.label}</div>
                       ))}
                     </div>
                    <div className="flex h-[24px] border-b border-slate-300 bg-slate-100 relative z-10 print:bg-slate-100 print:text-slate-900 text-slate-700">
                      {fyQuarterBlocks.map((block, i) => <div key={`${block.label}-${i}`} style={{ width: `${monthWidth * block.count}px` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-300 text-[9px] font-medium uppercase tracking-wider text-slate-500 print:text-slate-900">{block.label}</div>)}
                    </div>
                    <div className="flex h-[22px] bg-slate-50 border-b border-black/10 relative z-10 print:bg-white text-slate-500">
                      {viewMonths.map(m => <div key={`${m.year}-${m.month}`} style={{ width: `${monthWidth}px` }} className="shrink-0 h-full flex items-center justify-center border-r border-black/10 text-[8.5px] font-medium uppercase tracking-wide print:text-slate-900">{m.label}</div>)}
                    </div>
                  </div>

                  {/* Grid Lines (Monthly & Fiscal) */}
                  <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-[10]">
                    {/* Monthly Dividers */}
                    {viewMonths.map((m, idx) => {
                      if (idx === 0) return null; // Skip first bit
                      const style = { left: `${idx * monthWidth}px` };
                      return (
                        <div 
                          key={`month-divider-${idx}`} 
                          style={style} 
                          className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-black/5 print:border-slate-600"
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
	                  <div className="relative flex-1 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92)_100%)]">
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
	                      {galleries.map((gallery) => {
	                         const g = gallery.name;
	                         const laneHeight = galleryLaneHeights[g] || BASE_LANE_HEIGHT;
	                         const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === g);

	                         const footprints = galleryProjects.map(ex => {
	                           const startPos = getPositionFromDate(ex.startDate, monthWidth, viewMonths);
	                           const endPos = getPositionFromDate(ex.endDate, monthWidth, viewMonths);
	                           const prePhases = (ex.phases || []).filter(p => !phaseTypes.find(t => t.id === p.typeId)?.isPost);
	                           const totalPreWidth = prePhases.reduce((acc, p) => acc + p.durationMonths * monthWidth, 0) + (prePhases.length * PHASE_GAP);
	                           const phaseStartPos = startPos - totalPreWidth;
	                           const activePhase = prePhases.find(p => phaseTypes.find(t => t.id === p.typeId)?.isActive);
	                           let activeStartPos = startPos;
	                           let currentOffset = 0;
	                           for (const p of prePhases) {
	                             const pWidth = p.durationMonths * monthWidth;
	                             if (activePhase && p.id === activePhase.id) {
	                               activeStartPos = phaseStartPos + currentOffset;
	                               break;
	                             }
	                             currentOffset += pWidth + PHASE_GAP;
	                           }
	                           return { activeStart: activeStartPos, activeEnd: endPos };
	                         });

                         const overlapRegions: { startX: number, endX: number }[] = [];
                         for (let i = 0; i < footprints.length; i++) {
                           for (let j = i + 1; j < footprints.length; j++) {
                             const a = footprints[i];
                             const b = footprints[j];
                             if (Math.max(a.activeStart, b.activeStart) < Math.min(a.activeEnd, b.activeEnd)) {
                               overlapRegions.push({
                                 startX: Math.max(a.activeStart, b.activeStart),
                                 endX: Math.min(a.activeEnd, b.activeEnd)
                               });
                             }
                           }
                         }

                         const mergedOverlaps: { startX: number, endX: number }[] = [];
                         const sortedRegions = overlapRegions.sort((a,b) => a.startX - b.startX);
                         sortedRegions.forEach(region => {
                           if (mergedOverlaps.length === 0) {
                             mergedOverlaps.push({...region});
                           } else {
                             const last = mergedOverlaps[mergedOverlaps.length - 1];
                             if (region.startX <= last.endX) {
                               last.endX = Math.max(last.endX, region.endX);
                             } else {
                               mergedOverlaps.push({...region});
                             }
                           }
                         });

                         return (
	                           <div key={gallery.id} style={{ height: `${laneHeight}px` }} className={`border-b border-slate-300 gallery-lane-bg relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] ${gallery.kind === 'permanent' ? 'bg-[linear-gradient(180deg,rgba(254,252,232,0.6)_0%,rgba(254,243,199,0.35)_100%)]' : 'bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.95)_100%)]'}`}>
                             {showConflicts && mergedOverlaps.map((overlap, i) => (
                               <div 
                                 key={`overlap-${i}`}
                                 className="absolute bottom-0 z-[15] bg-red-500/5 border-l-2 border-r-2 border-dashed border-red-500/50 pointer-events-none"
                                 style={{ left: overlap.startX, width: Math.max(2, overlap.endX - overlap.startX), top: `${MILESTONE_ROW_HEIGHT}px` }}
                               >
                                 <div className="bg-white border-2 border-red-500/50 text-red-600 font-semibold uppercase text-[8px] tracking-widest flex items-center shadow-sm w-max ml-2 mt-2" style={{ padding: '2px 4px' }}>
                                   <AlertTriangle size={10} className="mr-1.5 shrink-0" strokeWidth={3} /> CONFLICT
                                 </div>
                               </div>
                             ))}
                             <div
                               style={{ height: `${MILESTONE_ROW_HEIGHT}px` }}
                               className="absolute top-0 left-0 w-full bg-slate-100/60 border-b-2 border-slate-200 z-20 group relative cursor-crosshair overflow-visible shadow-sm"
                               onDoubleClick={async (e) => {
                                 const rect = e.currentTarget.getBoundingClientRect();
                                 const x = Math.max(0, e.clientX - rect.left + timelineRef.current!.scrollLeft);
                                 const date = getDateFromPosition(x, monthWidth, viewMonths);
                                 const id = Math.random().toString(36).substr(2,9);
                                 const newMilestone: LocationMilestone = { 
                                   id, 
                                   gallery: g, 
                                   title: 'MILESTONE', 
                                   date 
                                 };
                                 setLocationMilestones([...locationMilestones, newMilestone]);
                                 setEditMilestoneDraft(newMilestone);
                                 // Auto-save handled by useMuseumSync.
                               }}
                             >
                                <div className="absolute left-4 h-full flex items-center" />
                                {(() => {
                                  const gMilestones = locationMilestones.filter(m => m.gallery === g)
                                    .map(m => ({ ...m, xPos: getPositionFromDate(m.date, monthWidth, viewMonths) }))
                                    .sort((a, b) => a.xPos - b.xPos);

                                  const labelPositions = new Array(gMilestones.length).fill('top');
                                  let lastTopX = -9999;
                                  let lastBottomX = -9999;
                                  
                                  for (let i = 0; i < gMilestones.length; i++) {
                                    const curr = gMilestones[i];
                                    if (curr.xPos - lastTopX >= 65) {
                                      labelPositions[i] = 'top';
                                      lastTopX = curr.xPos;
                                    } else if (curr.xPos - lastBottomX >= 65) {
                                      labelPositions[i] = 'bottom';
                                      lastBottomX = curr.xPos;
                                    } else {
                                      labelPositions[i] = 'top';
                                    }
                                  }

                                  return gMilestones.map((m, idx) => {
                                    const labelPos = labelPositions[idx];
                                    return (
                                      <div 
                                        key={m.id} 
                                        className="absolute top-1/2 flex items-center justify-center pointer-events-auto"
                                        style={{ left: `${m.xPos}px`, transform: 'translate(-50%, -50%)' }}
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
                                          {m.icon === 'flag' ? (
                                            <div className="relative flex items-center justify-center pointer-events-none mt-1">
                                              <Flag size={16} fill={m.color || '#dc2626'} stroke="black" strokeWidth={2} className="drop-shadow-[1px_1px_0_rgba(0,0,0,1)]" />
                                            </div>
                                          ) : (
                                            <div className="w-3.5 h-3.5 bg-white border-[1.5px] border-slate-300 rotate-45 shadow-[1px_1px_0_0_rgba(0,0,0,1)] flex items-center justify-center pointer-events-none">
                                              <div className="w-[4px] h-[4px]" style={{ backgroundColor: m.color || '#dc2626' }} />
                                            </div>
                                          )}
                                        </div>
                                        <div className={`absolute left-1/2 -translate-x-1/2 text-[9px] font-medium uppercase text-slate-600 bg-white px-1.5 py-[1px] leading-tight border border-slate-200 shadow-md opacity-90 transition-all hover:bg-slate-50 hover:opacity-100 whitespace-nowrap z-30 pointer-events-none ${labelPos === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}>
                                          {m.title}
                                        </div>
                                      </div>
                                  );
                                });
                              })()}
                             </div>

                              {galleryProjects.map(ex => {
                                const trackIndex = galleryLayouts[g]!.tracks[ex.id];
                                if (trackIndex === undefined || trackIndex === 0) return null;
                                return (
                                  <div key={`line-${ex.id}`} className="absolute w-full border-t-[1.5px] border-slate-300 z-10 pointer-events-none" style={{ top: MILESTONE_ROW_HEIGHT + trackIndex * TRACK_HEIGHT }} />
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
                                  
                                  const trackTop = MILESTONE_ROW_HEIGHT + (trackIndex * TRACK_HEIGHT);

                                  const prePhasesRaw = (ex.phases || []).filter(p => !phaseTypes.find(t => t.id === p.typeId)?.isPost);
                                  const postPhasesRaw = (ex.phases || []).filter(p => phaseTypes.find(t => t.id === p.typeId)?.isPost);
                                  
                                  const totalPrePhaseWidthOnly = prePhasesRaw.reduce((acc, p) => acc + p.durationMonths * monthWidth, 0);
                                  const totalPreGaps = prePhasesRaw.length * PHASE_GAP;
                                  const totalPreWidth = totalPrePhaseWidthOnly + totalPreGaps;
                                  const phaseStartPos = startPos - totalPreWidth;
                                  
                                  let preOffset = 0;
                                  const renderedPre = prePhasesRaw.map((p, i) => {
                                    const pWidth = p.durationMonths * monthWidth;
                                    const pStart = phaseStartPos + preOffset;
                                    const pEnd = pStart + pWidth;
                                    const pY = trackTop + (i * TRACK_HEIGHT) + (TRACK_HEIGHT - PHASE_BAR_HEIGHT) / 2;
                                    preOffset += pWidth + PHASE_GAP;
                                    return { ...p, startX: pStart, width: pWidth, endX: pEnd, y: pY, type: phaseTypes.find(t => t.id === p.typeId), i, isPost: false };
                                  });

                                  const mainBarY = trackTop + (prePhasesRaw.length * TRACK_HEIGHT) + (TRACK_HEIGHT - STANDARD_BAR_HEIGHT) / 2;

                                  let postOffset = PHASE_GAP;
                                  const renderedPost = postPhasesRaw.map((p, i) => {
                                    const pWidth = p.durationMonths * monthWidth;
                                    const pStart = endPos + postOffset;
                                    const pEnd = pStart + pWidth;
                                    const targetYIndex = prePhasesRaw.length > 0 ? prePhasesRaw.length - 1 : 0;
                                    const pY = trackTop + (targetYIndex * TRACK_HEIGHT) + (TRACK_HEIGHT - PHASE_BAR_HEIGHT) / 2;
                                    postOffset += pWidth + PHASE_GAP;
                                    return { ...p, startX: pStart, width: pWidth, endX: pEnd, y: pY, type: phaseTypes.find(t => t.id === p.typeId), i: i, isPost: true };
                                  });

                                  const renderedPhases = [...renderedPre, ...renderedPost];

                                  return (
                                    <React.Fragment key={ex.id}>
                                      <div className={`absolute pointer-events-none transition-opacity duration-200 ${isDraggingThis ? 'opacity-30' : ''}`}>
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

                                          const labelTextColor = phase.type?.color
                                            ? (parseInt(phase.type.color.slice(1, 3), 16) * 299 + parseInt(phase.type.color.slice(3, 5), 16) * 587 + parseInt(phase.type.color.slice(5, 7), 16) * 114) / 1000 >= 160 ? '#0f172a' : '#ffffff'
                                            : '#0f172a';
                                          return (
                                            <React.Fragment key={phase.id}>
                                              <div
                                                className="absolute flex items-center justify-start px-1 shadow-sm hover:shadow-md hover:opacity-90 transition-all pointer-events-auto border border-white/60 overflow-hidden"
                                                style={{ left: `${phase.startX}px`, top: `${phase.y}px`, width: `${Math.max(phase.width - 2, 0)}px`, height: `${PHASE_BAR_HEIGHT}px`, backgroundColor: phase.type?.color || '#eee' }}
                                                title={phase.label}
                                              >
                                                {phase.width >= 32 && (
                                                  <span
                                                    className="text-[8px] font-bold tracking-tight truncate leading-none w-full"
                                                    style={{ color: labelTextColor }}
                                                  >
                                                    {phase.label}
                                                  </span>
                                                )}
                                              </div>
                                              {hasNext && (
                                                <svg className="absolute overflow-visible pointer-events-none z-0" style={{ left: 0, top: 0, width: 1, height: 1 }}>
                                                  <path 
                                                    d={nextYCenter === yCenter 
                                                      ? `M ${phase.endX} ${yCenter} L ${nextX - 2} ${nextYCenter}` 
                                                      : `M ${phase.endX} ${yCenter} L ${phase.endX + 3} ${yCenter} L ${phase.endX + 3} ${nextYCenter} L ${nextX - 2} ${nextYCenter}`
                                                    } 
                                                    fill="none" 
                                                    stroke="#475569" 
                                                    strokeWidth="1.5" 
                                                  />
                                                  <circle cx={phase.endX} cy={yCenter} r="2" fill="#475569" />
                                                  <polygon points={`${nextX},${nextYCenter} ${nextX-5},${nextYCenter-3} ${nextX-5},${nextYCenter+3}`} fill="#475569" />
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
                                                  ? `M ${endPos} ${curYCenter} L ${nX - 2} ${nYCenter}`
                                                  : `M ${endPos} ${curYCenter} L ${endPos + 3} ${curYCenter} L ${endPos + 3} ${nYCenter} L ${nX - 2} ${nYCenter}`
                                                }
                                                fill="none" 
                                                stroke="#475569" 
                                                strokeWidth="1.5" 
                                              />
                                              <circle cx={endPos} cy={curYCenter} r="2" fill="#475569" />
                                              <polygon points={`${nX},${nYCenter} ${nX-5},${nYCenter-3} ${nX-5},${nYCenter+3}`} fill="#475569" />
                                            </svg>
                                          );
                                        })()}
                                      </div>

                                      <motion.div
                                        layoutId={`project-${ex.id}`}
                                        aria-label={`Project: ${ex.title} (${ex.status}). Click to view details, long-press to drag.`}
                                        role="button"
                                        tabIndex={0}
                                        onMouseDown={(e) => onBarMouseDown(e, ex)}
                                        onClick={() => { if (!draggingBarId) setSelectedProjectId(ex.id); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProjectId(ex.id); }}
                                        whileHover={{ 
                                          y: -2, 
                                          scale: 1.005,
                                          transition: { duration: 0.2, ease: "easeOut" }
                                        }}
                                        whileTap={{ scale: 0.99 }}
                                        className={`absolute pointer-events-auto border border-black/10 shadow-[0_8px_16px_rgba(15,23,42,0.16)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.25)] transition-all cursor-pointer flex items-stretch overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/50 print:border-slate-800 print:shadow-none ${isDraggingThis ? 'project-bar-dragging ring-2 ring-blue-500' : ''}`}
                                        style={{
                                          left: `${startPos}px`,
                                          width: `${width}px`,
                                          top: `${mainBarY}px`,
                                          height: `${STANDARD_BAR_HEIGHT}px`,
                                          backgroundColor: '#b91c1c',
                                          backgroundImage: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)'
                                        }}
                                      >
                                          <div
                                            className="shrink-0 h-full flex items-center justify-center px-2 bg-black/10 border-r border-white/10"
                                            title={ex.status}
                                          >
                                            <StatusIcon status={ex.status} size={12} className="text-white opacity-90" />
                                          </div>
                                          <div className="flex-1 min-w-0 flex items-center justify-center px-2">
                                            {width >= 180 ? (
                                              <span className="font-bold text-[10px] uppercase tracking-[0.14em] text-white truncate block leading-none pb-[0.5px]">
                                                {ex.title} • {formatBarDate(effStartDate)} - {formatBarDate(effEndDate)}
                                              </span>
                                            ) : width >= 100 ? (
                                              <span className="font-bold text-[10px] uppercase tracking-[0.14em] text-white truncate block leading-none pb-[0.5px]">{ex.title}</span>
                                            ) : (
                                              <span className="font-bold text-[9px] uppercase tracking-[0.18em] text-white px-1 leading-none pb-[0.5px] truncate">
                                                {ex.exhibitionId || 'PROJECT'}
                                              </span>
                                            )}
                                          </div>
                                      </motion.div>
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                           </div>
                         );
                      })}
                    </div>
                    
                    <div className="absolute inset-0 flex pointer-events-none z-0">
                      {viewMonths.map((m) => <div key={`bg-${m.year}-${m.month}`} style={{ width: `${monthWidth}px` }} className={`h-full border-r border-slate-200/5 shrink-0 ${m.month === 3 ? 'border-l-[1.5px] border-dashed border-slate-400/20' : ''}`} />)}
                    </div>


                  </div>
                </div>


              </div>
            </main>
          </div>
        </>
	        ) : (
	          <div className="p-8 py-6 max-w-4xl mx-auto space-y-8 overflow-y-auto h-full bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] no-print custom-scrollbar flex flex-col">
	            <header className="space-y-3">
	              <button 
	                onClick={() => setActiveTab('portfolio')} 
	                className="inline-flex items-center font-medium uppercase text-[9px] border border-slate-300 px-3 py-1.5 hover:bg-slate-50 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus:ring-2 focus:ring-blue-500/50 bg-white"
	              >
	                <ArrowLeft size={12} className="mr-2" /> DASHBOARD
	              </button>
	              <div className="border border-slate-200 bg-white/80 backdrop-blur-sm shadow-[0_20px_40px_rgba(15,23,42,0.06)] px-6 py-6">
                  <h2 className="text-3xl font-semibold uppercase tracking-tight">SYSTEM SETTINGS</h2>
                </div>
	            </header>
	            
	            <div className="space-y-8">
	              <section className="space-y-6">
	                <div className="flex items-center text-sm font-semibold uppercase tracking-widest space-x-3 text-slate-900"><Building2 size={18} /><span>ORG STANDARDS</span></div>
	                <div className="border border-slate-300 p-6 bg-white shadow-sm hover:shadow-md transition-all">
                  <label htmlFor="museum-name-input" className="text-[11px] font-semibold uppercase mb-2 block text-slate-600">ORGANIZATION NAME</label>
                  <input 
                    id="museum-name-input"
                    className="w-full text-lg font-semibold bg-white border border-slate-300 p-3 outline-none uppercase shadow-inner focus:border-slate-300 transition-colors" 
                    value={museumName} 
                    onChange={(e) => setMuseumName(e.target.value.toUpperCase())} 
                  />
                </div>
              </section>

	              <section className="space-y-6">
	                <div className="flex items-center text-sm font-semibold uppercase tracking-widest space-x-3 text-slate-900"><Palette size={18} /><span>PHASE TYPES</span></div>
	                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
	                  {phaseTypes.map((type, idx) => (
	                    <div key={type.id} className="flex items-center space-x-3 p-4 border border-slate-300 bg-white shadow-sm hover:shadow-md hover:border-slate-400 transition-all">
                      <div className="flex flex-col">
                        <label htmlFor={`phase-color-${idx}`} className="sr-only">Phase Color {idx + 1}</label>
                        <input 
                          id={`phase-color-${idx}`}
                          type="color" 
                          className="w-8 h-8 border border-slate-300 bg-transparent cursor-pointer outline-none" 
                          value={type.color} 
                          onChange={(e) => {
                            const next = [...phaseTypes];
                            next[idx].color = e.target.value;
                            setPhaseTypes(next);
                          }} 
                        />
                      </div>
	                      <div className="flex-1 flex flex-col">
	                        <label htmlFor={`phase-label-${idx}`} className="sr-only">Phase Label {idx + 1}</label>
	                        <input 
	                          id={`phase-label-${idx}`}
	                          className="w-full font-medium uppercase text-[12px] outline-none border-b border-transparent focus:border-slate-300 bg-transparent" 
	                          value={type.label} 
	                          onChange={(e) => {
	                            const next = [...phaseTypes];
	                            next[idx].label = e.target.value.toUpperCase();
	                            setPhaseTypes(next);
	                          }} 
	                        />
                          <div className="flex items-center gap-1 mt-2">
                            {type.isActive && <span className="px-2 py-0.5 border border-amber-200 bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-[0.14em]">Active Window</span>}
                            {type.isPost && <span className="px-2 py-0.5 border border-slate-300 bg-slate-200 text-slate-700 text-[10px] font-semibold uppercase tracking-[0.14em]">Post Phase</span>}
                            {!type.isActive && !type.isPost && <span className="px-2 py-0.5 border border-slate-200 bg-slate-100 text-slate-500 text-[10px] font-semibold uppercase tracking-[0.14em]">Preparation</span>}
                          </div>
	                      </div>
	                    </div>
	                  ))}
                </div>
              </section>

	              <section className="space-y-6 pb-20">
	                <div className="flex items-center justify-between">
	                  <div className="flex items-center text-sm font-semibold uppercase tracking-widest space-x-3 text-slate-900"><MapPin size={18} /><span>LOCATIONS & GALLERIES</span></div>
	                  <button 
	                    onClick={handleAddGallery}
	                    className="text-[11px] font-semibold uppercase bg-slate-900 text-white px-3 py-1.5 hover:bg-slate-800 transition-colors shadow-sm"
	                  >
	                    + ADD LOCATION
	                  </button>
	                </div>
	                <div className="space-y-3">
	                  {galleries.map((gallery, idx) => (
	                    <div key={gallery.id} className="flex items-center space-x-3 p-4 border border-slate-300 bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="w-8 h-8 bg-slate-100 flex items-center justify-center font-semibold text-slate-600 text-sm">{idx + 1}</div>
                      <input
                        aria-label={`Location name ${idx + 1}`}
                        className="flex-1 font-semibold uppercase text-[14px] border-b-2 border-transparent focus:border-slate-300 bg-transparent outline-none py-1"
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
                      <div className="inline-flex border border-slate-300 overflow-hidden text-[10px] font-bold uppercase tracking-[0.12em] shrink-0" role="group" aria-label={`Gallery type for ${gallery.name}`}>
                        <button
                          type="button"
                          onClick={() => handleSetGalleryKind(gallery.id, 'temporary')}
                          className={`px-2.5 py-1.5 transition-colors ${gallery.kind !== 'permanent' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          aria-pressed={gallery.kind !== 'permanent'}
                        >
                          TEMP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetGalleryKind(gallery.id, 'permanent')}
                          className={`px-2.5 py-1.5 border-l border-slate-300 transition-colors ${gallery.kind === 'permanent' ? 'bg-amber-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          aria-pressed={gallery.kind === 'permanent'}
                        >
                          PERM
                        </button>
                      </div>
                      <button
                        aria-label={`Remove location ${gallery.name}`}
                        disabled={galleries.length <= 1}
                        onClick={() => handleRemoveGallery(gallery.id)}
                        className={`p-2 text-slate-400 hover:text-red-600 transition-colors ${galleries.length <= 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MasterScheduler />);
}
