import React, { useState } from 'react';
import { X, Key, Database, Info } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function GithubAuthModal({ onClose }: Props) {
  const [pat, setPat] = useState(localStorage.getItem('github_pat') || '');
  const [gistId, setGistId] = useState(localStorage.getItem('github_gist_id') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!pat.trim()) {
      setError('Personal Access Token is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { createGist, getGistData } = await import('../lib/githubGist');
      
      let finalGistId = gistId.trim();
      
      if (!finalGistId) {
        const { useStore } = await import('../store/useStore');
        const state = useStore.getState();
        const initialData = {
          museumName: state.museumName,
          galleries: state.galleries,
          phaseTypes: state.phaseTypes,
          exhibitions: state.exhibitions,
          locationMilestones: state.locationMilestones
        };
        finalGistId = await createGist(pat, initialData);
      } else {
        await getGistData(finalGistId, pat);
      }

      localStorage.setItem('github_pat', pat);
      localStorage.setItem('github_gist_id', finalGistId);
      
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with GitHub');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-[100] backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-300 w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 text-white px-4 py-3 font-semibold tracking-widest flex justify-between items-center text-[12px]">
          <span>GITHUB GIST SYNC</span>
          <button aria-label="Close" onClick={onClose} className="hover:text-red-400 transition-colors">
            <X size={14} strokeWidth={3} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Key size={12} /> Personal Access Token
              </label>
              <input 
                type="password" 
                className="w-full border border-slate-300 p-3 font-medium text-sm outline-none focus:bg-slate-50 transition-colors" 
                value={pat} 
                onChange={(e) => setPat(e.target.value)} 
                placeholder="ghp_..."
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Database size={12} /> Gist ID (Optional)
              </label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-3 font-medium text-sm outline-none focus:bg-slate-50 transition-colors" 
                value={gistId} 
                onChange={(e) => setGistId(e.target.value)} 
                placeholder="Leave blank to create new"
              />
            </div>

            {error && (
              <div className="text-red-600 text-[11px] font-semibold p-2 bg-red-50 border border-red-200">
                {error}
              </div>
            )}
          </div>
          
          <div className="flex justify-end items-center pt-4 border-t border-slate-200/10 mt-6">
            <button 
              onClick={handleSave}
              disabled={loading}
              className="bg-slate-900 text-white px-6 py-2.5 border border-slate-300 font-medium uppercase text-[12px] tracking-widest hover:bg-slate-800 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'CONNECTING...' : 'SAVE & CONNECT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
