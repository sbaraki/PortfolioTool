import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, Edit2, X, Trash2, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { Exhibition, Gallery, ProjectPhase, PhaseType } from '../types';
import { getDateWithMonthDuration, getDurationMonths } from '../lib/dateUtils';
import { getStatusStyles } from '../constants';

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

  useEffect(() => { 
    setEditedEx(exhibition); 
    setIsEditing(false); 
    setEditingPhaseId(null);
  }, [exhibition]);

  const handleSaveAll = () => { onUpdate(editedEx); setIsEditing(false); };
  const handleFieldChange = (field: keyof Exhibition, value: any) => { setEditedEx(prev => ({ ...prev, [field]: value })); };

  const handleAddPhase = () => {
    const newPhase: ProjectPhase = {
      id: Math.random().toString(36).substr(2, 9),
      label: 'NEW PHASE',
      durationMonths: 1,
      typeId: phaseTypes[0]?.id || 'pt1'
    };
    const updatedPhases = [...editedEx.phases, newPhase];
    setEditedEx(prev => ({ ...prev, phases: updatedPhases }));
    setEditingPhaseId(newPhase.id);
    setLocalPhaseDraft(newPhase);
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

  const totalProjectDuration = useMemo(() => {
    return getDurationMonths(editedEx.startDate, editedEx.endDate);
  }, [editedEx.startDate, editedEx.endDate]);

  const handleDurationChange = (months: number) => {
    handleFieldChange('endDate', getDateWithMonthDuration(editedEx.startDate, months));
  };

  return (
    <motion.aside 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] border-l border-slate-200 z-[100] flex flex-col no-print shadow-[-20px_0_50px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-blue-500/20"
    >
      <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white/90 backdrop-blur-sm">
        <div className="flex-1 mr-4">
          {isEditing ? (
            <div className="flex flex-col">
              <label htmlFor="ex-title" className="text-[11px] font-semibold uppercase text-slate-600 tracking-tight">Project Title</label>
              <input 
                id="ex-title"
                className="text-lg font-medium text-slate-900 w-full bg-slate-50 border border-slate-300 p-2 outline-none focus:bg-white focus:ring-2 focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm transition-all duration-200" 
                value={editedEx.title} 
                onChange={(e) => handleFieldChange('title', e.target.value.toUpperCase())} 
              />
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 leading-none uppercase tracking-tight">{exhibition.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className="font-semibold text-[12px] uppercase tracking-tight px-3 py-1 border inline-flex items-center shadow-sm"
                  style={{
                    backgroundColor: getStatusStyles(exhibition.status).bg,
                    borderColor: getStatusStyles(exhibition.status).border,
                    color: getStatusStyles(exhibition.status).text
                  }}
                >
                  {getStatusStyles(exhibition.status).label}
                </span>
                <span className="px-3 py-1 border border-slate-200 bg-white text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-700">{exhibition.gallery}</span>
                <span className="px-3 py-1 border border-slate-200 bg-white text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-700">{totalProjectDuration} Months</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <button 
              aria-label="Save all changes"
              onClick={handleSaveAll} 
              className="w-10 h-10 bg-slate-900 text-white border border-slate-300 flex items-center justify-center hover:bg-white hover:text-slate-900 transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50"
            >
              <Check size={20} />
            </button>
          ) : (
            <button 
              aria-label="Edit project"
              onClick={() => setIsEditing(true)} 
              className="w-10 h-10 bg-white border border-slate-300 text-slate-900 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50"
            >
              <Edit2 size={18} />
            </button>
          )}
          <button 
            aria-label="Close panel"
            onClick={onClose} 
            className="w-10 h-10 bg-white border border-slate-300 text-slate-900 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar"
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1 border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <span id="label-status" className="text-[11px] font-semibold uppercase text-slate-600 tracking-[0.18em]">PROJECT STATUS</span>
            {isEditing ? (
              <select 
                id="ex-status"
                className="w-full font-medium border border-slate-300 p-2 outline-none text-sm bg-white text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm" 
                value={editedEx.status} 
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                {['Proposed', 'In Development', 'Open to Public', 'Closed'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            ) : (
              <div>
                <p 
                  className="font-semibold text-[12px] uppercase tracking-tight px-3 py-1 border inline-flex items-center shadow-sm" 
                  style={{ 
                    backgroundColor: getStatusStyles(exhibition.status).bg,
                    borderColor: getStatusStyles(exhibition.status).border,
                    color: getStatusStyles(exhibition.status).text
                  }}
                >
                  {getStatusStyles(exhibition.status).label}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border border-slate-300 space-y-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold uppercase tracking-[0.16em] text-slate-700">Scheduling Core</h3>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ex-id" className="text-[11px] font-semibold uppercase text-slate-600 tracking-tight">EXHIBITION ID</label>
            {isEditing ? (
              <input 
                id="ex-id"
                className="w-full font-medium border border-slate-300 p-2 text-sm bg-white text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:shadow-sm" 
                value={editedEx.exhibitionId || ''} 
                placeholder="EX-0000-000"
                onChange={(e) => handleFieldChange('exhibitionId', e.target.value.toUpperCase())} 
              />
            ) : (
              <p className="font-medium text-sm uppercase text-blue-600 tracking-tight">{exhibition.exhibitionId || 'UNASSIGNED'}</p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="ex-gallery" className="text-[11px] font-semibold uppercase text-slate-600 tracking-tight">GALLERY LANE</label>
            {isEditing ? (
              <select 
                id="ex-gallery"
                className="w-full font-medium border border-slate-300 p-2 outline-none text-sm bg-white text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm" 
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
              <p className="font-medium text-sm uppercase">{exhibition.gallery}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="ex-start-date" className="text-[11px] font-semibold uppercase text-slate-600 tracking-tight">START DATE</label>
              {isEditing ? (
                <input 
                  id="ex-start-date"
                  type="date" 
                  className="w-full border border-slate-300 p-2 text-xs font-medium tracking-tight bg-white text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm" 
                  value={editedEx.startDate} 
                  onChange={(e) => handleFieldChange('startDate', e.target.value)} 
                />
              ) : (
                <p className="text-sm font-medium">{exhibition.startDate}</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="ex-end-date" className="text-[11px] font-semibold uppercase text-slate-600 tracking-tight">END DATE</label>
              {isEditing ? (
                <input 
                  id="ex-end-date"
                  type="date" 
                  className="w-full border border-slate-300 p-2 text-xs font-medium tracking-tight bg-white text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm" 
                  value={editedEx.endDate} 
                  onChange={(e) => handleFieldChange('endDate', e.target.value)} 
                />
              ) : (
                <p className="text-sm font-medium">{exhibition.endDate}</p>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <label htmlFor="ex-duration" className="text-[11px] font-semibold uppercase text-slate-600 block tracking-tight">TOTAL PROJECT DURATION</label>
            {isEditing ? (
              <div className="flex items-center space-x-2 mt-1">
                <input 
                  id="ex-duration"
                  type="number"
                  min="0.1"
                  step="0.1"
                  className="w-24 border border-slate-300 bg-white text-slate-900 font-semibold p-2 outline-none focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm"
                  value={totalProjectDuration}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleDurationChange(val);
                  }}
                />
                <span className="text-xs font-semibold uppercase tracking-tight">MONTHS</span>
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-900 mt-1 uppercase tracking-tight">{totalProjectDuration} MONTHS</p>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="space-y-4 border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-tight">INTERNAL PHASING</h3>
              <button 
                aria-label="Add new phase"
                onClick={handleAddPhase} 
                className="bg-slate-900 text-white px-3 py-1.5 text-[12px] font-medium uppercase tracking-tight hover:bg-slate-700 focus:ring-2 focus:ring-blue-500/50"
              >
                + ADD PHASE
              </button>
            </div>
            <div className="space-y-2">
              {editedEx.phases.map((phase, idx) => {
                const isPhaseEditing = editingPhaseId === phase.id;
                
                return (
                  <div key={phase.id} className={`border border-slate-300 p-3 flex items-start justify-between bg-white shadow-sm hover:shadow-md transition-all duration-200 ${isPhaseEditing ? 'bg-yellow-50/30' : ''}`}>
                    <div className="flex items-start space-x-3 w-full">
                      <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px] font-medium shrink-0 mt-1">{idx + 1}</div>
                      <div className="flex flex-col flex-1 min-w-0">
                        {isPhaseEditing ? (
                          <div className="flex flex-col space-y-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight">LABEL</label>
                              <input 
                                autoFocus
                                aria-label={`Phase ${idx + 1} Label`}
                                className="font-medium text-xs uppercase border border-slate-300 outline-none bg-white text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm w-full p-2"
                                value={localPhaseDraft?.label || ''}
                                onChange={(e) => setLocalPhaseDraft(prev => prev ? { ...prev, label: e.target.value.toUpperCase() } : null)}
                              />
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight">DURATION (MO)</label>
                                <input 
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  aria-label={`Phase ${idx + 1} Duration`}
                                  className="font-semibold text-xs uppercase border border-slate-300 bg-white text-slate-900 outline-none w-20 p-2 text-center focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm"
                                  value={localPhaseDraft?.durationMonths || 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setLocalPhaseDraft(prev => prev ? { ...prev, durationMonths: isNaN(val) ? 0 : val } : null);
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight">TYPE</label>
                                <select 
                                  className="font-semibold text-[11px] uppercase border border-slate-300 bg-white text-slate-900 outline-none p-1.5 focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm"
                                  value={localPhaseDraft?.typeId || ''}
                                  onChange={(e) => setLocalPhaseDraft(prev => prev ? { ...prev, typeId: e.target.value } : null)}
                                >
                                  {phaseTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                               <button 
                                onClick={handleSavePhaseLocal}
                                className="bg-slate-900 text-white px-3 py-1.5 text-[12px] font-medium uppercase tracking-tight flex items-center hover:bg-slate-700 transition-all duration-200 shadow-sm active:scale-95"
                              >
                                <Check size={14} className="mr-1.5" /> CONFIRM
                              </button>
                              <button 
                                onClick={handleCancelPhaseLocal}
                                className="bg-white border border-slate-300 text-slate-900 px-3 py-1.5 text-[12px] font-medium uppercase tracking-tight flex items-center hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-95"
                              >
                                <X size={14} className="mr-1.5" /> CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center space-x-2">
                               <span className="font-medium text-xs uppercase tracking-tight truncate text-slate-900">{phase.label}</span>
                               <div className="w-2 h-2 border border-slate-200" style={{ backgroundColor: phaseTypes.find(t => t.id === phase.typeId)?.color }} />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-tight">{phase.durationMonths} MO</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!isPhaseEditing && (
                      <div className="flex items-center space-x-1 shrink-0 ml-2 mt-1">
                        <div className="flex flex-col">
                          <button 
                            aria-label={`Move phase ${idx + 1} up`}
                            disabled={idx === 0}
                            onClick={() => handleMovePhase(idx, 'up')}
                            className={`p-0.5 hover:bg-slate-900 hover:text-white transition-all duration-200 border border-transparent hover:border-slate-300 ${idx === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button 
                            aria-label={`Move phase ${idx + 1} down`}
                            disabled={idx === editedEx.phases.length - 1}
                            onClick={() => handleMovePhase(idx, 'down')}
                            className={`p-0.5 hover:bg-slate-900 hover:text-white transition-all duration-200 border border-transparent hover:border-slate-300 ${idx === editedEx.phases.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <button 
                          aria-label={`Edit phase ${idx + 1}`}
                          onClick={() => handleStartEditPhase(phase)} 
                          className="p-1 text-slate-900 hover:text-blue-600 transition-all duration-200 border border-transparent hover:border-slate-300"
                        >
                          <Edit2 size={16}/>
                        </button>
                        <button 
                          aria-label={`Remove phase ${idx + 1}`}
                          onClick={() => handleRemovePhase(phase.id)} 
                          className="p-1 text-slate-900 hover:text-red-600 transition-all duration-200 border border-transparent hover:border-slate-300"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 border border-slate-300 bg-white p-5 shadow-sm">
          <label htmlFor="ex-description" className="text-[12px] font-semibold uppercase tracking-[0.16em] border-b border-slate-200 pb-2 block text-slate-700">NARRATIVE</label>
          <div className="p-4 border border-slate-300 bg-slate-50/35 min-h-[120px] shadow-sm">
            {isEditing ? (
              <textarea 
                id="ex-description"
                className="w-full text-[13px] font-medium bg-transparent text-slate-900 border-none outline-none h-28 uppercase resize-none focus:bg-white focus:border-blue-500 focus:ring-blue-500/50 focus:shadow-sm" 
                value={editedEx.description} 
                onChange={(e) => handleFieldChange('description', e.target.value.toUpperCase())} 
              />
            ) : (
              <p className="text-[13px] font-medium uppercase leading-relaxed text-slate-700">
                {exhibition.description || "NO PROJECT DESCRIPTION PROVIDED."}
              </p>
            )}
          </div>
        </div>
      </motion.div>

          <div className="p-5 border-t border-slate-200 flex gap-3 bg-white/90 backdrop-blur-sm shrink-0">
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 bg-white border border-slate-300 font-semibold uppercase tracking-tight text-[12px] hover:bg-slate-100 focus:ring-2 focus:ring-blue-500/50">DISCARD</button>
            <button onClick={handleSaveAll} className="flex-1 py-2.5 bg-slate-900 text-white border border-slate-300 font-semibold uppercase tracking-tight text-[12px] hover:bg-slate-700 focus:ring-2 focus:ring-blue-500/50 shadow-sm">SAVE ALL</button>
          </>
        ) : (
          <>
            <button 
              aria-label="Duplicate this project"
              onClick={() => onDuplicate(exhibition.id)} 
              className="flex-1 py-2.5 bg-white border border-slate-300 font-semibold uppercase tracking-tight text-[12px] flex items-center justify-center hover:bg-slate-100 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
            >
              <Copy size={13} className="mr-2" /> DUPLICATE
            </button>
            <button 
              aria-label="Delete this project"
              onClick={() => onDelete(exhibition.id)} 
              className="flex-1 py-2.5 bg-white border border-slate-300 font-semibold uppercase tracking-tight text-[12px] flex items-center justify-center hover:bg-red-500 hover:text-white focus:ring-2 focus:ring-red-500 transition-all duration-200"
            >
              <Trash2 size={13} className="mr-2" /> REMOVE
            </button>
          </>
        )}
      </div>
    </motion.aside>
  );
};
