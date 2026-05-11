import React, { useState, useMemo, useEffect } from 'react';
import { Check, Edit2, X, Trash2, ChevronUp, ChevronDown, Copy, Plus, Flag } from 'lucide-react';
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

const sortCheckpoints = (checkpoints: ProjectCheckpoint[]) => [...checkpoints].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

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
  const [isEditing, setIsEditing] = useState(false);
  const [editedEx, setEditedEx] = useState<Exhibition>(exhibition);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [localPhaseDraft, setLocalPhaseDraft] = useState<ProjectPhase | null>(null);
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [localCheckpointDraft, setLocalCheckpointDraft] = useState<ProjectCheckpoint | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, onClose]);

  useEffect(() => {
    setEditedEx(exhibition);
    setIsEditing(false);
    setEditingPhaseId(null);
    setEditingCheckpointId(null);
    setLocalCheckpointDraft(null);
  }, [exhibition]);

  const handleSaveAll = () => {
    let next = editedEx;
    if (editingPhaseId && localPhaseDraft) {
      next = {
        ...next,
        phases: next.phases.map(p => p.id === localPhaseDraft.id ? localPhaseDraft : p)
      };
      setEditingPhaseId(null);
      setLocalPhaseDraft(null);
    }
    if (editingCheckpointId && localCheckpointDraft) {
      next = {
        ...next,
        checkpoints: sortCheckpoints((next.checkpoints || []).map(c => c.id === localCheckpointDraft.id ? localCheckpointDraft : c))
      };
      setEditingCheckpointId(null);
      setLocalCheckpointDraft(null);
    }
    setEditedEx(next);
    onUpdate(next);
    setIsEditing(false);
  };
  const handleFieldChange = (field: keyof Exhibition, value: any) => { setEditedEx(prev => ({ ...prev, [field]: value })); };

  const handleStartDateChange = (value: string) => {
    setEditedEx(prev => ({
      ...prev,
      startDate: value,
      endDate: prev.scheduleMode !== 'single-date' && prev.endDate && prev.endDate < value ? value : prev.endDate
    }));
  };

  const handleEndDateChange = (value: string) => {
    setEditedEx(prev => ({
      ...prev,
      endDate: value < prev.startDate ? prev.startDate : value
    }));
  };

  const handleAddPhase = () => {
    const newPhase: ProjectPhase = {
      id: Math.random().toString(36).slice(2, 11),
      label: 'NEW PHASE',
      durationMonths: 1,
      typeId: phaseTypes[0]?.id || 'pt1'
    };
    const updatedPhases = [...editedEx.phases, newPhase];
    setEditedEx(prev => ({ ...prev, phases: updatedPhases }));
    setEditingPhaseId(newPhase.id);
    setLocalPhaseDraft(newPhase);
  };

  const handleApplyPreset = (preset: string) => {
    let newPhases: ProjectPhase[] = [];
    const phaseByLabel = (fragment: string) => phaseTypes.find(p => p.label.toUpperCase().includes(fragment))?.id;
    if (preset === 'standard') {
      newPhases = [
        { id: Math.random().toString(36).slice(2, 11), label: 'CONTENT', durationMonths: 3, typeId: phaseByLabel('CONTENT') || 'pt2' },
        { id: Math.random().toString(36).slice(2, 11), label: 'DESIGN', durationMonths: 3, typeId: phaseByLabel('DESIGN') || 'pt3' },
        { id: Math.random().toString(36).slice(2, 11), label: 'BUILD', durationMonths: 2, typeId: phaseByLabel('IMPLEMENTATION') || 'pt4' },
      ];
    } else if (preset === 'full') {
      newPhases = phaseTypes.map(pt => ({
        id: Math.random().toString(36).slice(2, 11),
        label: pt.label,
        durationMonths: 2,
        typeId: pt.id
      }));
    } else if (preset === 'simple') {
      newPhases = [
        { id: Math.random().toString(36).slice(2, 11), label: 'PLANNING & DESIGN', durationMonths: 2, typeId: phaseByLabel('DESIGN') || 'pt3' },
        { id: Math.random().toString(36).slice(2, 11), label: 'IMPLEMENTATION', durationMonths: 2, typeId: phaseByLabel('IMPLEMENTATION') || 'pt4' },
      ];
    } else if (preset === 'clear') {
      newPhases = [];
    }
    
    if (preset !== '') {
      if (window.confirm('Replace current phases with this preset?')) {
        setEditedEx(prev => ({ ...prev, phases: newPhases }));
        setEditingPhaseId(null);
        setLocalPhaseDraft(null);
      }
    }
  };

  const handleRemovePhase = (id: string) => {
    setEditedEx(prev => ({ ...prev, phases: prev.phases.filter(p => p.id !== id) }));
  };

  const handleStartEditPhase = (phase: ProjectPhase) => {
    setEditingPhaseId(phase.id);
    setLocalPhaseDraft({ ...phase });
  };

  const handleSavePhaseLocal = () => {
    if (!localPhaseDraft) return;
    const newPhases = editedEx.phases.map(p => p.id === localPhaseDraft.id ? localPhaseDraft : p);
    handleFieldChange('phases', newPhases);
    setEditingPhaseId(null);
    setLocalPhaseDraft(null);
  };

  const handleCancelPhaseLocal = () => {
    setEditingPhaseId(null);
    setLocalPhaseDraft(null);
  };

  const handleMovePhase = (idx: number, direction: 'up' | 'down') => {
    const newPhases = [...editedEx.phases];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newPhases.length) return;
    [newPhases[idx], newPhases[targetIdx]] = [newPhases[targetIdx], newPhases[idx]];
    handleFieldChange('phases', newPhases);
  };

  const handleAddCheckpoint = (preset?: (typeof CHECKPOINT_PRESETS)[number]) => {
    const newCheckpoint: ProjectCheckpoint = {
      id: Math.random().toString(36).slice(2, 11),
      title: preset?.title || 'NEW MILESTONE',
      date: toISODate(new Date()),
      kind: preset?.kind || 'other'
    };
    const updated = sortCheckpoints([...(editedEx.checkpoints || []), newCheckpoint]);
    setEditedEx(prev => ({ ...prev, checkpoints: updated }));
    setEditingCheckpointId(newCheckpoint.id);
    setLocalCheckpointDraft(newCheckpoint);
  };

  const handleRemoveCheckpoint = (id: string) => {
    setEditedEx(prev => ({
      ...prev,
      checkpoints: (prev.checkpoints || []).filter(c => c.id !== id)
    }));
    if (editingCheckpointId === id) {
      setEditingCheckpointId(null);
      setLocalCheckpointDraft(null);
    }
  };

  const handleStartEditCheckpoint = (checkpoint: ProjectCheckpoint) => {
    setEditingCheckpointId(checkpoint.id);
    setLocalCheckpointDraft({ ...checkpoint });
  };

  const handleSaveCheckpointLocal = () => {
    if (!localCheckpointDraft) return;
    const trimmedTitle = localCheckpointDraft.title.trim();
    if (!trimmedTitle) {
      handleRemoveCheckpoint(localCheckpointDraft.id);
      return;
    }
    const next = sortCheckpoints((editedEx.checkpoints || []).map(c =>
      c.id === localCheckpointDraft.id ? { ...localCheckpointDraft, title: trimmedTitle } : c
    )
    );
    handleFieldChange('checkpoints', next);
    setEditingCheckpointId(null);
    setLocalCheckpointDraft(null);
  };

  const handleCancelCheckpointLocal = () => {
    setEditingCheckpointId(null);
    setLocalCheckpointDraft(null);
  };

  const totalProjectDuration = useMemo(() => {
    return getDurationMonths(editedEx.startDate, editedEx.endDate);
  }, [editedEx.startDate, editedEx.endDate]);

  const handleDurationChange = (months: number) => {
    handleFieldChange('endDate', getDateWithMonthDuration(editedEx.startDate, months));
  };

  const inputCls = "w-full bg-white border border-slate-200 px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 transition-colors";
  const labelCls = "text-[10px] font-medium uppercase tracking-tight text-slate-600";
  const sectionCls = "border border-slate-200 bg-white p-3 space-y-3";
  const sectionHeaderCls = "text-[11px] font-semibold uppercase tracking-tight text-slate-700";

  return (
    <aside
      className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-white border-l border-slate-200 z-[140] flex flex-col no-print shadow-[-8px_0_24px_rgba(15,23,42,0.06)]"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-start gap-3 bg-white">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-1">
              <label htmlFor="ex-title" className={labelCls}>Project Title</label>
              <input
                id="ex-title"
                className="w-full text-[14px] font-semibold text-slate-900 bg-white border border-slate-200 px-2 py-1.5 outline-none focus:border-slate-400 transition-colors uppercase tracking-tight"
                value={editedEx.title}
                onChange={(e) => handleFieldChange('title', e.target.value.toUpperCase())}
              />
            </div>
          ) : (
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900 leading-tight uppercase tracking-tight truncate" title={exhibition.title}>{exhibition.title}</h2>
              <div className="flex flex-wrap items-center gap-1 mt-2">
                <span
                  className="font-medium text-[10px] uppercase tracking-tight px-1.5 py-0.5 border inline-flex items-center leading-none"
                  style={{
                    backgroundColor: getStatusStyles(exhibition.status).bg,
                    borderColor: getStatusStyles(exhibition.status).border,
                    color: getStatusStyles(exhibition.status).text
                  }}
                >
                  {getStatusStyles(exhibition.status).label}
                </span>
                <span className="px-1.5 py-0.5 border border-slate-200 bg-white text-[10px] font-medium uppercase tracking-tight text-slate-600 leading-none">{exhibition.gallery}</span>
                {exhibition.scheduleMode === 'single-date' ? (
                  <span className="px-1.5 py-0.5 bg-slate-900 text-[10px] font-medium uppercase tracking-tight text-white leading-none">Single date</span>
                ) : (
                  <span className="px-1.5 py-0.5 border border-slate-200 bg-white text-[10px] font-medium uppercase tracking-tight text-slate-600 leading-none">{totalProjectDuration} mo</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <button
              aria-label="Save all changes"
              onClick={handleSaveAll}
              className="p-1.5 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <Check size={14} />
            </button>
          ) : (
            <button
              aria-label="Edit project"
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={14} />
            </button>
          )}
          <button
            aria-label="Close panel"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50">
        {/* Status */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <span className={sectionHeaderCls}>Status</span>
          </div>
          {isEditing ? (
            <select
              id="ex-status"
              className={inputCls}
              value={editedEx.status}
              onChange={(e) => handleFieldChange('status', e.target.value)}
            >
              {['TBC', 'In Development', 'Open to Public', 'Closed'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          ) : (
            <span
              className="font-medium text-[11px] uppercase tracking-tight px-1.5 py-0.5 border inline-flex items-center leading-none"
              style={{
                backgroundColor: getStatusStyles(exhibition.status).bg,
                borderColor: getStatusStyles(exhibition.status).border,
                color: getStatusStyles(exhibition.status).text
              }}
            >
              {getStatusStyles(exhibition.status).label}
            </span>
          )}
        </div>

        {/* Scheduling Core */}
        <div className={sectionCls}>
          <span className={sectionHeaderCls}>Scheduling</span>

          <div className="space-y-1">
            <label htmlFor="ex-id" className={labelCls}>Exhibition ID</label>
            {isEditing ? (
              <input
                id="ex-id"
                className={inputCls}
                value={editedEx.exhibitionId || ''}
                placeholder="EXH000"
                onChange={(e) => handleFieldChange('exhibitionId', e.target.value.toUpperCase())}
              />
            ) : (
              <p className="text-[12px] font-mono text-slate-700">{exhibition.exhibitionId || '—'}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="ex-gallery" className={labelCls}>Gallery</label>
            {isEditing ? (
              <select
                id="ex-gallery"
                className={inputCls}
                value={editedEx.gallery}
                onChange={(e) => handleFieldChange('gallery', e.target.value)}
              >
                {galleries.map(g => (
                  <option key={g.id} value={g.name}>
                    {g.name}{g.kind === 'permanent' ? ' (PERMANENT)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[12px] font-medium text-slate-700 uppercase tracking-tight">{exhibition.gallery}</p>
            )}
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-100">
            <span className={labelCls}>Schedule type</span>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-1">
                {[
                  { value: 'range', label: 'Date range' },
                  { value: 'single-date', label: 'Single date' },
                ].map(option => {
                  const active = editedEx.scheduleMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEditedEx(prev => {
                        const scheduleMode = option.value as Exhibition['scheduleMode'];
                        return {
                          ...prev,
                          scheduleMode,
                          endDate: scheduleMode === 'single-date'
                            ? prev.startDate
                            : (prev.endDate <= prev.startDate ? getDateWithMonthDuration(prev.startDate, 3) : prev.endDate)
                        };
                      })}
                      className={`px-2 py-1.5 text-[10px] font-medium uppercase tracking-tight border transition-colors ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] font-medium text-slate-700 uppercase tracking-tight">
                {exhibition.scheduleMode === 'single-date' ? 'Single date' : 'Date range'}
              </p>
            )}
          </div>

          {editedEx.scheduleMode === 'single-date' ? (
            <div className="space-y-1">
              {isEditing ? (
                <DatePicker
                  value={editedEx.startDate}
                  onChange={(val) => setEditedEx(prev => ({ ...prev, startDate: val, endDate: val }))}
                  label="Date"
                />
              ) : (
                <p className="text-[12px] font-medium text-slate-700">{exhibition.startDate}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  {isEditing ? (
                    <DatePicker
                      value={editedEx.startDate}
                      onChange={(val) => handleStartDateChange(val)}
                      label="Start"
                    />
                  ) : (
                    <p className="text-[12px] font-medium text-slate-700">{exhibition.startDate}</p>
                  )}
                </div>
                <div className="space-y-1">
                  {isEditing ? (
                    <DatePicker
                      value={editedEx.endDate}
                      onChange={(val) => handleEndDateChange(val)}
                      label="End"
                    />
                  ) : (
                    <p className="text-[12px] font-medium text-slate-700">{exhibition.endDate}</p>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label htmlFor="ex-duration" className={labelCls}>Total duration</label>
                {isEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id="ex-duration"
                      type="number"
                      min="0.1"
                      step="0.1"
                      className="w-20 bg-white border border-slate-200 px-2 py-1.5 text-[12px] font-medium text-slate-900 outline-none focus:border-slate-400 transition-colors"
                      value={totalProjectDuration}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleDurationChange(val);
                      }}
                    />
                    <span className="text-[10px] font-medium uppercase tracking-tight text-slate-600">months</span>
                  </div>
                ) : (
                  <p className="text-[12px] font-medium text-slate-700 mt-1">{totalProjectDuration} months</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Internal Phasing (edit-only) */}
        {isEditing && (
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <span className={sectionHeaderCls}>Phases</span>
              <div className="flex items-center gap-2">
                <select 
                  className="bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium uppercase text-slate-700 outline-none hover:bg-slate-50 transition-colors cursor-pointer"
                  onChange={(e) => {
                    handleApplyPreset(e.target.value);
                    e.target.value = "";
                  }}
                  value=""
                >
                  <option value="" disabled>Presets...</option>
                  <option value="standard">Standard (3 Phase)</option>
                  <option value="full">Full (All Types)</option>
                  <option value="simple">Simple (2 Phase)</option>
                  <option value="clear">Clear All</option>
                </select>
                <button
                  aria-label="Add new phase"
                  onClick={handleAddPhase}
                  className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none"
                >
                  <Plus size={10} strokeWidth={2.5} /> Add
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {editedEx.phases.map((phase, idx) => {
                const isPhaseEditing = editingPhaseId === phase.id;
                return (
                  <div key={phase.id} className={`border border-slate-200 p-2 bg-white transition-colors ${isPhaseEditing ? 'bg-slate-50' : ''}`}>
                    {isPhaseEditing ? (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className={labelCls}>Label</label>
                          <input
                            autoFocus
                            aria-label={`Phase ${idx + 1} Label`}
                            className={inputCls + ' uppercase'}
                            value={localPhaseDraft?.label || ''}
                            onChange={(e) => setLocalPhaseDraft(prev => prev ? { ...prev, label: e.target.value.toUpperCase() } : null)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className={labelCls}>Duration (mo)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              aria-label={`Phase ${idx + 1} Duration`}
                              className={inputCls}
                              value={localPhaseDraft?.durationMonths || 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setLocalPhaseDraft(prev => prev ? { ...prev, durationMonths: isNaN(val) ? 0 : val } : null);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={labelCls}>Type</label>
                            <select
                              className={inputCls}
                              value={localPhaseDraft?.typeId || ''}
                              onChange={(e) => setLocalPhaseDraft(prev => prev ? { ...prev, typeId: e.target.value } : null)}
                            >
                              {phaseTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            onClick={handleSavePhaseLocal}
                            className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none"
                          >
                            <Check size={10} strokeWidth={2.5} /> Confirm
                          </button>
                          <button
                            onClick={handleCancelPhaseLocal}
                            className="px-2 py-1 border border-slate-200 bg-white text-slate-700 text-[10px] font-medium uppercase tracking-tight hover:bg-slate-50 transition-colors leading-none"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-4 h-4 bg-slate-900 text-white flex items-center justify-center text-[9px] font-medium shrink-0 leading-none">{idx + 1}</div>
                          <div className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: phaseTypes.find(t => t.id === phase.typeId)?.color }} />
                          <span className="text-[11px] font-medium uppercase tracking-tight text-slate-900 truncate">{phase.label}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">{phase.durationMonths}mo</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            aria-label={`Move phase ${idx + 1} up`}
                            disabled={idx === 0}
                            onClick={() => handleMovePhase(idx, 'up')}
                            className={`p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors ${idx === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                          >
                            <ChevronUp size={11} />
                          </button>
                          <button
                            aria-label={`Move phase ${idx + 1} down`}
                            disabled={idx === editedEx.phases.length - 1}
                            onClick={() => handleMovePhase(idx, 'down')}
                            className={`p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors ${idx === editedEx.phases.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                          >
                            <ChevronDown size={11} />
                          </button>
                          <button
                            aria-label={`Edit phase ${idx + 1}`}
                            onClick={() => handleStartEditPhase(phase)}
                            className="p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            aria-label={`Remove phase ${idx + 1}`}
                            onClick={() => handleRemovePhase(phase.id)}
                            className="p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Key Milestones */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className={sectionHeaderCls}>Key milestones</span>
            </div>
            {isEditing && (
              <button
                aria-label="Add milestone"
                onClick={() => handleAddCheckpoint()}
                className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none shrink-0"
              >
                <Plus size={10} strokeWidth={2.5} /> Add
              </button>
            )}
          </div>
          {isEditing && (
            <div className="flex flex-wrap gap-1">
              {CHECKPOINT_PRESETS.map(preset => (
                <button
                  key={preset.kind}
                  type="button"
                  onClick={() => handleAddCheckpoint(preset)}
                  className="px-1.5 py-1 border border-slate-200 bg-white text-[9px] font-medium uppercase tracking-tight text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          {((isEditing ? editedEx.checkpoints : exhibition.checkpoints) || []).length === 0 && (
            <p className="text-[10px] text-slate-400 italic">
              {isEditing ? "No milestones yet." : "No milestones. Click edit to add one."}
            </p>
          )}
          <div className="space-y-1.5">
            {((isEditing ? editedEx.checkpoints : exhibition.checkpoints) || []).map((checkpoint, idx) => {
              const isCheckpointEditing = editingCheckpointId === checkpoint.id;
              return (
                <div key={checkpoint.id} className={`border border-slate-200 p-2 bg-white transition-colors ${isCheckpointEditing ? 'bg-slate-50' : ''}`}>
                  {isCheckpointEditing && localCheckpointDraft ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className={labelCls}>Title</label>
                        <input
                          autoFocus
                          aria-label={`Milestone ${idx + 1} title`}
                          className={inputCls + ' uppercase'}
                          value={localCheckpointDraft.title}
                          onChange={(e) => setLocalCheckpointDraft(prev => prev ? { ...prev, title: e.target.value.toUpperCase() } : null)}
                        />
                      </div>
                      <DatePicker
                        value={localCheckpointDraft.date}
                        onChange={(val) => setLocalCheckpointDraft(prev => prev ? { ...prev, date: val } : null)}
                        label="Date"
                      />
                      <div className="space-y-1">
                        <label className={labelCls}>Kind</label>
                        <select
                          className={inputCls}
                          value={localCheckpointDraft.kind}
                          onChange={(e) => setLocalCheckpointDraft(prev => prev ? { ...prev, kind: e.target.value as CheckpointKind } : null)}
                        >
                          {Object.entries(CHECKPOINT_KIND_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <button
                          onClick={handleSaveCheckpointLocal}
                          className="px-2 py-1 bg-slate-900 text-white text-[10px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors flex items-center gap-1 leading-none"
                        >
                          <Check size={10} strokeWidth={2.5} /> Confirm
                        </button>
                        <button
                          onClick={handleCancelCheckpointLocal}
                          className="px-2 py-1 border border-slate-200 bg-white text-slate-700 text-[10px] font-medium uppercase tracking-tight hover:bg-slate-50 transition-colors leading-none"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="shrink-0 w-4 flex items-center justify-center">
                          <Flag size={12} strokeWidth={2} className="text-slate-500" />
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-tight text-slate-900 truncate">{checkpoint.title}</span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-tight shrink-0">{CHECKPOINT_KIND_LABELS[checkpoint.kind]}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{checkpoint.date}</span>
                      </div>
                      {isEditing && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            aria-label={`Edit milestone ${idx + 1}`}
                            onClick={() => handleStartEditCheckpoint(checkpoint)}
                            className="p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            aria-label={`Remove milestone ${idx + 1}`}
                            onClick={() => handleRemoveCheckpoint(checkpoint.id)}
                            className="p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className={sectionCls}>
          <label htmlFor="ex-description" className={sectionHeaderCls}>Notes</label>
          {isEditing ? (
            <textarea
              id="ex-description"
              className="w-full bg-white border border-slate-200 px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 transition-colors h-24 resize-none uppercase tracking-tight"
              value={editedEx.description}
              onChange={(e) => handleFieldChange('description', e.target.value.toUpperCase())}
            />
          ) : (
            <p className="text-[12px] text-slate-700 uppercase tracking-tight leading-relaxed whitespace-pre-wrap">
              {exhibition.description || <span className="text-slate-400 italic normal-case">No notes yet.</span>}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 flex gap-2 bg-white shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-1.5 border border-slate-200 bg-white text-slate-700 text-[11px] font-medium uppercase tracking-tight hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSaveAll}
              className="flex-1 py-1.5 bg-slate-900 text-white text-[11px] font-medium uppercase tracking-tight hover:bg-slate-800 transition-colors"
            >
              Save All
            </button>
          </>
        ) : (
          <>
            <button
              aria-label="Duplicate this project"
              onClick={() => onDuplicate(exhibition.id)}
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
          </>
        )}
      </div>
    </aside>
  );
};
