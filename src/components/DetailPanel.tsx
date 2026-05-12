import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Flag, Plus, Trash2, X } from 'lucide-react';
import { CheckpointKind, Exhibition, Gallery, ProjectCheckpoint, ProjectPhase, PhaseType } from '../types';
import { getDateWithMonthDuration, getDurationMonths, toISODate } from '../lib/dateUtils';
import { getStatusStyles } from '../constants';
import { DatePicker } from './DatePicker';

const CHECKPOINT_PRESETS: { kind: CheckpointKind; label: string; title: string }[] = [
  { kind: 'kickoff', label: 'Kickoff', title: 'KICKOFF' },
  { kind: 'review', label: 'Review', title: 'REVIEW' },
  { kind: 'approval', label: 'Approval', title: 'APPROVAL' },
  { kind: 'install', label: 'Install', title: 'INSTALL' },
  { kind: 'opening', label: 'Opening', title: 'OPENING' },
  { kind: 'close', label: 'Close', title: 'CLOSE' },
];

const CHECKPOINT_KIND_LABELS: Record<CheckpointKind, string> = {
  kickoff: 'Kickoff',
  review: 'Review',
  approval: 'Approval',
  install: 'Install',
  opening: 'Opening',
  close: 'Close',
  other: 'Other',
};

type SaveStatus = 'saved' | 'saving' | 'error';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const createId = () => Math.random().toString(36).slice(2, 11);
const sortCheckpoints = (checkpoints: ProjectCheckpoint[]) => [...checkpoints].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
const serialize = (exhibition: Exhibition) => JSON.stringify(exhibition);
const isValidISODate = (value: string) => {
  if (!ISO_DATE_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
};

export const DetailPanel = ({
  exhibition,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  galleries,
  phaseTypes
}: {
  exhibition: Exhibition;
  onClose: () => void;
  onUpdate: (ex: Exhibition) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  galleries: Gallery[];
  phaseTypes: PhaseType[];
}) => {
  const [draft, setDraft] = useState<Exhibition>(exhibition);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});
  const [focusedPhaseId, setFocusedPhaseId] = useState<string | null>(null);
  const [focusedCheckpointId, setFocusedCheckpointId] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef(serialize(exhibition));
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const nextSerialized = serialize(exhibition);
    lastSavedRef.current = nextSerialized;
    setDateErrors({});
    if (draftRef.current.id !== exhibition.id) {
      setDraft(exhibition);
      setFocusedPhaseId(null);
      setFocusedCheckpointId(null);
      setSaveStatus('saved');
    }
  }, [exhibition]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  const flushSave = (next: Exhibition = draftRef.current) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const nextSerialized = serialize(next);
    if (nextSerialized === lastSavedRef.current) {
      setSaveStatus('saved');
      return;
    }
    try {
      setSaveStatus('saving');
      onUpdate(next);
      lastSavedRef.current = nextSerialized;
      window.setTimeout(() => setSaveStatus('saved'), 180);
    } catch (error) {
      console.error('Project save failed', error);
      setSaveStatus('error');
    }
  };

  const queueSave = (next: Exhibition, immediate = false) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    if (immediate) {
      flushSave(next);
      return;
    }
    saveTimerRef.current = window.setTimeout(() => flushSave(next), 700);
  };

  const applyDraft = (updater: Exhibition | ((prev: Exhibition) => Exhibition), immediate = false) => {
    const next = typeof updater === 'function' ? updater(draftRef.current) : updater;
    draftRef.current = next;
    setDraft(next);
    queueSave(next, immediate);
  };

  const commitOnEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.currentTarget.tagName !== 'TEXTAREA') {
      e.preventDefault();
      flushSave();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const totalProjectDuration = useMemo(() => getDurationMonths(draft.startDate, draft.endDate), [draft.startDate, draft.endDate]);
  const phaseTypeById = useMemo(() => new Map(phaseTypes.map(type => [type.id, type])), [phaseTypes]);

  const setDateError = (key: string, message?: string) => {
    setDateErrors(prev => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  };

  const applyDate = (key: string, value: string, updater: (date: string) => Exhibition) => {
    if (!isValidISODate(value)) {
      setDateError(key, 'Use YYYY-MM-DD');
      return;
    }
    setDateError(key);
    applyDraft(updater(value), true);
  };

  const updateScheduleMode = (scheduleMode: Exhibition['scheduleMode']) => {
    applyDraft(prev => ({
      ...prev,
      scheduleMode,
      endDate: scheduleMode === 'single-date'
        ? prev.startDate
        : (prev.endDate <= prev.startDate ? getDateWithMonthDuration(prev.startDate, 3) : prev.endDate)
    }), true);
  };

  const updateStartDate = (value: string, immediate = true) => {
    applyDate('startDate', value, date => ({
      ...draftRef.current,
      startDate: date,
      endDate: draftRef.current.scheduleMode === 'single-date'
        ? date
        : (draftRef.current.endDate < date ? date : draftRef.current.endDate)
    }));
    if (!immediate) queueSave(draftRef.current);
  };

  const updateEndDate = (value: string) => {
    applyDate('endDate', value, date => ({
      ...draftRef.current,
      endDate: date < draftRef.current.startDate ? draftRef.current.startDate : date
    }));
  };

  const updateDuration = (months: number) => {
    if (Number.isNaN(months)) return;
    applyDraft(prev => ({
      ...prev,
      endDate: getDateWithMonthDuration(prev.startDate, Math.max(0.1, months))
    }));
  };

  const addPhase = () => {
    const newPhase: ProjectPhase = {
      id: createId(),
      label: 'NEW PHASE',
      durationMonths: 1,
      typeId: phaseTypes[0]?.id || 'pt1'
    };
    setFocusedPhaseId(newPhase.id);
    applyDraft(prev => ({ ...prev, phases: [...prev.phases, newPhase] }), true);
  };

  const applyPreset = (preset: string) => {
    const phaseByLabel = (fragment: string) => phaseTypes.find(p => p.label.toUpperCase().includes(fragment))?.id;
    let phases: ProjectPhase[] = [];
    if (preset === 'standard') {
      phases = [
        { id: createId(), label: 'CONTENT', durationMonths: 3, typeId: phaseByLabel('CONTENT') || 'pt2' },
        { id: createId(), label: 'DESIGN', durationMonths: 3, typeId: phaseByLabel('DESIGN') || 'pt3' },
        { id: createId(), label: 'BUILD', durationMonths: 2, typeId: phaseByLabel('IMPLEMENTATION') || 'pt4' },
      ];
    } else if (preset === 'full') {
      phases = phaseTypes.map(pt => ({ id: createId(), label: pt.label, durationMonths: 2, typeId: pt.id }));
    } else if (preset === 'simple') {
      phases = [
        { id: createId(), label: 'PLANNING & DESIGN', durationMonths: 2, typeId: phaseByLabel('DESIGN') || 'pt3' },
        { id: createId(), label: 'IMPLEMENTATION', durationMonths: 2, typeId: phaseByLabel('IMPLEMENTATION') || 'pt4' },
      ];
    }
    applyDraft(prev => ({ ...prev, phases }), true);
    setFocusedPhaseId(phases[0]?.id ?? null);
  };

  const updatePhase = (id: string, patch: Partial<ProjectPhase>, immediate = false) => {
    applyDraft(prev => ({
      ...prev,
      phases: prev.phases.map(phase => phase.id === id ? { ...phase, ...patch } : phase)
    }), immediate);
  };

  const movePhase = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= draft.phases.length) return;
    const phases = [...draft.phases];
    [phases[idx], phases[targetIdx]] = [phases[targetIdx], phases[idx]];
    applyDraft(prev => ({ ...prev, phases }), true);
  };

  const removePhase = (id: string) => {
    applyDraft(prev => ({ ...prev, phases: prev.phases.filter(phase => phase.id !== id) }), true);
  };

  const addCheckpoint = (preset?: (typeof CHECKPOINT_PRESETS)[number]) => {
    const newCheckpoint: ProjectCheckpoint = {
      id: createId(),
      title: preset?.title || 'NEW MILESTONE',
      date: toISODate(new Date()),
      kind: preset?.kind || 'other'
    };
    setFocusedCheckpointId(newCheckpoint.id);
    applyDraft(prev => ({ ...prev, checkpoints: sortCheckpoints([...(prev.checkpoints || []), newCheckpoint]) }), true);
  };

  const updateCheckpoint = (id: string, patch: Partial<ProjectCheckpoint>, immediate = false) => {
    applyDraft(prev => ({
      ...prev,
      checkpoints: (patch.date ? sortCheckpoints : (items: ProjectCheckpoint[]) => items)((prev.checkpoints || []).map(checkpoint =>
        checkpoint.id === id ? { ...checkpoint, ...patch, title: (patch.title ?? checkpoint.title).trim() || checkpoint.title } : checkpoint
      ))
    }), immediate);
  };

  const removeCheckpoint = (id: string) => {
    applyDraft(prev => ({ ...prev, checkpoints: (prev.checkpoints || []).filter(checkpoint => checkpoint.id !== id) }), true);
  };

  const inputCls = "w-full bg-white border border-slate-200 px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 transition-colors";
  const compactInputCls = "bg-white border border-slate-200 px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-slate-400 transition-colors";
  const labelCls = "text-[10px] font-medium uppercase tracking-tight text-slate-600";
  const sectionCls = "border border-slate-200 bg-white p-3 space-y-3";
  const sectionHeaderCls = "text-[11px] font-semibold uppercase tracking-tight text-slate-700";
  const statusStyle = getStatusStyles(draft.status);

  return (
    <aside
      className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-white border-l border-slate-200 z-[140] flex flex-col no-print shadow-[-8px_0_24px_rgba(15,23,42,0.06)]"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-start gap-3 bg-white">
        <div className="flex-1 min-w-0 space-y-2">
          <label htmlFor="ex-title" className={labelCls}>Project Title</label>
          <input
            id="ex-title"
            className="w-full text-[14px] font-semibold text-slate-900 bg-white border border-slate-200 px-2 py-1.5 outline-none focus:border-slate-400 transition-colors uppercase tracking-tight"
            value={draft.title}
            onChange={(e) => applyDraft(prev => ({ ...prev, title: e.target.value.toUpperCase() }))}
            onBlur={() => flushSave()}
            onKeyDown={commitOnEnter}
          />
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="font-medium text-[10px] uppercase tracking-tight px-1.5 py-0.5 border inline-flex items-center leading-none"
              style={{ backgroundColor: statusStyle.bg, borderColor: statusStyle.border, color: statusStyle.text }}
            >
              {statusStyle.label}
            </span>
            <span className="px-1.5 py-0.5 border border-slate-200 bg-white text-[10px] font-medium uppercase tracking-tight text-slate-600 leading-none">{draft.gallery}</span>
            <span className="px-1.5 py-0.5 border border-slate-200 bg-white text-[10px] font-medium uppercase tracking-tight text-slate-600 leading-none">
              {draft.scheduleMode === 'single-date' ? 'Single date' : `${totalProjectDuration} mo`}
            </span>
            <span className={`ml-auto text-[10px] font-semibold uppercase tracking-tight ${saveStatus === 'error' ? 'text-red-600' : saveStatus === 'saving' ? 'text-blue-600' : 'text-emerald-700'}`}>
              {saveStatus === 'error' ? 'Error' : saveStatus === 'saving' ? 'Saving' : 'Saved'}
            </span>
          </div>
        </div>
        <button
          aria-label="Close panel"
          onClick={() => {
            flushSave();
            onClose();
          }}
          className="p-1.5 text-slate-500 hover:bg-slate-50 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50">
        <div className={sectionCls}>
          <span className={sectionHeaderCls}>Status</span>
          <select
            id="ex-status"
            className={inputCls}
            value={draft.status}
            onChange={(e) => applyDraft(prev => ({ ...prev, status: e.target.value as Exhibition['status'] }), true)}
            onKeyDown={commitOnEnter}
          >
            {['TBC', 'In Development', 'Open to Public', 'Closed'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>

        <div className={sectionCls}>
          <span className={sectionHeaderCls}>Scheduling</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="ex-id" className={labelCls}>Exhibition ID</label>
              <input
                id="ex-id"
                className={inputCls}
                value={draft.exhibitionId || ''}
                placeholder="EXH000"
                onChange={(e) => applyDraft(prev => ({ ...prev, exhibitionId: e.target.value.toUpperCase() }))}
                onBlur={() => flushSave()}
                onKeyDown={commitOnEnter}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ex-gallery" className={labelCls}>Gallery</label>
              <select
                id="ex-gallery"
                className={inputCls}
                value={draft.gallery}
                onChange={(e) => applyDraft(prev => ({ ...prev, gallery: e.target.value }), true)}
                onKeyDown={commitOnEnter}
              >
                {galleries.map(gallery => (
                  <option key={gallery.id} value={gallery.name}>
                    {gallery.name}{gallery.kind === 'permanent' ? ' (PERMANENT)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-100">
            <span className={labelCls}>Schedule type</span>
            <div className="grid grid-cols-2 gap-1">
              {[
                { value: 'range', label: 'Date range' },
                { value: 'single-date', label: 'Single date' },
              ].map(option => {
                const active = draft.scheduleMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateScheduleMode(option.value as Exhibition['scheduleMode'])}
                    className={`px-2 py-1.5 text-[10px] font-medium uppercase tracking-tight border transition-colors ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {draft.scheduleMode === 'single-date' ? (
            <DatePicker
              value={draft.startDate}
              onChange={(val) => updateStartDate(val)}
              onBlur={(val) => updateStartDate(val)}
              error={dateErrors.startDate}
              label="Date"
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <DatePicker
                  value={draft.startDate}
                  onChange={(val) => updateStartDate(val)}
                  onBlur={(val) => updateStartDate(val)}
                  error={dateErrors.startDate}
                  label="Start"
                />
                <DatePicker
                  value={draft.endDate}
                  onChange={(val) => updateEndDate(val)}
                  onBlur={(val) => updateEndDate(val)}
                  error={dateErrors.endDate}
                  label="End"
                />
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label htmlFor="ex-duration" className={labelCls}>Total duration</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    id="ex-duration"
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-20 bg-white border border-slate-200 px-2 py-1.5 text-[12px] font-medium text-slate-900 outline-none focus:border-slate-400 transition-colors"
                    value={totalProjectDuration}
                    onChange={(e) => updateDuration(parseFloat(e.target.value))}
                    onBlur={() => flushSave()}
                    onKeyDown={commitOnEnter}
                  />
                  <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">months</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={sectionCls}>
          <div className="flex items-center justify-between gap-2">
            <span className={sectionHeaderCls}>Phases</span>
            <div className="flex items-center gap-2">
              <select
                className="bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium uppercase text-slate-700 outline-none hover:bg-slate-50 transition-colors cursor-pointer"
                onChange={(e) => {
                  applyPreset(e.target.value);
                  e.target.value = '';
                }}
                value=""
              >
                <option value="" disabled>Presets...</option>
                <option value="standard">Standard</option>
                <option value="full">Full</option>
                <option value="simple">Simple</option>
                <option value="clear">Clear All</option>
              </select>
              <button
                aria-label="Add new phase"
                onClick={addPhase}
                className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none"
              >
                <Plus size={10} strokeWidth={2.5} /> Add
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {draft.phases.length === 0 && <p className="text-[10px] text-slate-400 italic">No phases yet.</p>}
            {draft.phases.map((phase, idx) => (
              <div key={phase.id} className="border border-slate-200 p-2 bg-white">
                <div className="grid grid-cols-[18px_1fr_64px_108px_auto] gap-1.5 items-center">
                  <div className="w-4 h-4 bg-slate-900 text-white flex items-center justify-center text-[9px] font-medium shrink-0 leading-none">{idx + 1}</div>
                  <input
                    aria-label={`Phase ${idx + 1} label`}
                    autoFocus={focusedPhaseId === phase.id}
                    className={`${compactInputCls} uppercase min-w-0`}
                    value={phase.label}
                    onFocus={() => setFocusedPhaseId(phase.id)}
                    onChange={(e) => updatePhase(phase.id, { label: e.target.value.toUpperCase() })}
                    onBlur={() => flushSave()}
                    onKeyDown={commitOnEnter}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    aria-label={`Phase ${idx + 1} duration`}
                    className={compactInputCls}
                    value={phase.durationMonths}
                    onChange={(e) => updatePhase(phase.id, { durationMonths: parseFloat(e.target.value) || 0 })}
                    onBlur={() => flushSave()}
                    onKeyDown={commitOnEnter}
                  />
                  <select
                    aria-label={`Phase ${idx + 1} type`}
                    className={`${compactInputCls} min-w-0`}
                    value={phase.typeId}
                    onChange={(e) => updatePhase(phase.id, { typeId: e.target.value }, true)}
                    onKeyDown={commitOnEnter}
                  >
                    {phaseTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                  </select>
                  <div className="flex items-center gap-0.5">
                    <span className="w-1.5 h-4 shrink-0" style={{ backgroundColor: phaseTypeById.get(phase.typeId)?.color }} />
                    <button aria-label={`Move phase ${idx + 1} up`} disabled={idx === 0} onClick={() => movePhase(idx, 'up')} className="p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed">
                      <ChevronUp size={11} />
                    </button>
                    <button aria-label={`Move phase ${idx + 1} down`} disabled={idx === draft.phases.length - 1} onClick={() => movePhase(idx, 'down')} className="p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed">
                      <ChevronDown size={11} />
                    </button>
                    <button aria-label={`Remove phase ${idx + 1}`} onClick={() => removePhase(phase.id)} className="p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCls}>
          <div className="flex items-center justify-between gap-2">
            <span className={sectionHeaderCls}>Key milestones</span>
            <button
              aria-label="Add milestone"
              onClick={() => addCheckpoint()}
              className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none shrink-0"
            >
              <Plus size={10} strokeWidth={2.5} /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {CHECKPOINT_PRESETS.map(preset => (
              <button
                key={preset.kind}
                type="button"
                onClick={() => addCheckpoint(preset)}
                className="px-1.5 py-1 border border-slate-200 bg-white text-[9px] font-medium uppercase tracking-tight text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {(draft.checkpoints || []).length === 0 && <p className="text-[10px] text-slate-400 italic">No milestones yet.</p>}
          <div className="space-y-1.5">
            {(draft.checkpoints || []).map((checkpoint, idx) => (
              <div key={checkpoint.id} className="border border-slate-200 p-2 bg-white">
                <div className="grid grid-cols-[18px_1fr_108px_100px_auto] gap-1.5 items-center">
                  <Flag size={12} strokeWidth={2} className="text-slate-500" />
                  <input
                    aria-label={`Milestone ${idx + 1} title`}
                    autoFocus={focusedCheckpointId === checkpoint.id}
                    className={`${compactInputCls} uppercase min-w-0`}
                    value={checkpoint.title}
                    onFocus={() => setFocusedCheckpointId(checkpoint.id)}
                    onChange={(e) => updateCheckpoint(checkpoint.id, { title: e.target.value.toUpperCase() })}
                    onBlur={() => flushSave()}
                    onKeyDown={commitOnEnter}
                  />
                  <DatePicker
                    value={checkpoint.date}
                    onChange={(val) => updateCheckpoint(checkpoint.id, { date: val }, true)}
                    onBlur={(val) => {
                      if (isValidISODate(val)) updateCheckpoint(checkpoint.id, { date: val }, true);
                    }}
                    label=""
                    className="min-w-0"
                  />
                  <select
                    className={`${compactInputCls} min-w-0`}
                    value={checkpoint.kind}
                    onChange={(e) => updateCheckpoint(checkpoint.id, { kind: e.target.value as CheckpointKind }, true)}
                    onKeyDown={commitOnEnter}
                  >
                    {Object.entries(CHECKPOINT_KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label.toUpperCase()}</option>
                    ))}
                  </select>
                  <button aria-label={`Remove milestone ${idx + 1}`} onClick={() => removeCheckpoint(checkpoint.id)} className="p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCls}>
          <label htmlFor="ex-description" className={sectionHeaderCls}>Notes</label>
          <textarea
            id="ex-description"
            className="w-full bg-white border border-slate-200 px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 transition-colors h-24 resize-none uppercase tracking-tight"
            value={draft.description || ''}
            onChange={(e) => applyDraft(prev => ({ ...prev, description: e.target.value.toUpperCase() }))}
            onBlur={() => flushSave()}
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 flex gap-2 bg-white shrink-0">
        <button
          aria-label="Duplicate this project"
          onClick={() => {
            flushSave();
            onDuplicate(exhibition.id);
          }}
          className="flex-1 py-1.5 border border-slate-200 bg-white text-slate-700 text-[11px] font-medium uppercase tracking-tight hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Copy size={11} /> Duplicate
        </button>
        <button
          aria-label="Delete this project"
          onClick={() => onDelete(exhibition.id)}
          className="flex-1 py-1.5 border border-slate-200 bg-white text-slate-700 text-[11px] font-medium uppercase tracking-tight hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 size={11} /> Remove
        </button>
      </div>
    </aside>
  );
};
