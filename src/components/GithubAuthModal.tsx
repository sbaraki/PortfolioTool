import React, { useState } from 'react';
import { ChevronDown, Database, Info, Key, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const looksLikeGithubToken = (value: string) => /^(github_pat_|gh[pousr]_)/.test(value.trim());

const parseGistId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const urlMatch = trimmed.match(/gist\.github\.com\/(?:[^/\s]+\/)?([a-f0-9]{20,64})(?:[/?#]|$)/i);
  if (urlMatch) return urlMatch[1];

  if (/^[a-f0-9]{20,64}$/i.test(trimmed)) return trimmed;

  return null;
};

export function GithubAuthModal({ onClose }: Props) {
  const [pat, setPat] = useState(localStorage.getItem('github_pat') || '');
  const [gistId, setGistId] = useState(localStorage.getItem('github_gist_id') || '');
  const [showAdvanced, setShowAdvanced] = useState(Boolean(localStorage.getItem('github_gist_id')));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const trimmedPat = pat.trim();
    const trimmedGistId = gistId.trim();

    if (!trimmedPat && looksLikeGithubToken(trimmedGistId)) {
      setPat(trimmedGistId);
      setGistId('');
      setShowAdvanced(false);
      setError('That was a GitHub token, so I moved it to the GitHub Token field. Leave Existing Gist ID blank to create a private sync Gist.');
      return;
    }

    if (!trimmedPat) {
      setError('Paste a GitHub token with Gist access to start syncing.');
      return;
    }

    if (looksLikeGithubToken(trimmedGistId)) {
      setError('Existing Gist ID should be a Gist ID or Gist URL, not a GitHub token. Clear this field unless you already have a Portfolio Tool sync Gist.');
      return;
    }

    const parsedGistId = parseGistId(trimmedGistId);
    if (parsedGistId === null) {
      setError('Existing Gist ID should look like a GitHub Gist ID or a full gist.github.com URL.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { createGist, findExistingPortfolioGist, getGistData } = await import('../lib/githubGist');

      let finalGistId = parsedGistId;

      if (!finalGistId) {
        const existingGist = await findExistingPortfolioGist(trimmedPat);

        if (existingGist) {
          finalGistId = existingGist.id;
        } else {
          const { useStore } = await import('../store/useStore');
          const state = useStore.getState();
          const initialData = {
            museumName: state.museumName,
            galleries: state.galleries,
            phaseTypes: state.phaseTypes,
            exhibitions: state.exhibitions,
            locationMilestones: state.locationMilestones
          };
          finalGistId = await createGist(trimmedPat, initialData);
        }
      } else {
        await getGistData(finalGistId, trimmedPat);
      }

      localStorage.setItem('github_pat', trimmedPat);
      localStorage.setItem('github_gist_id', finalGistId);

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to start GitHub sync');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-[150] backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-300 w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 text-white px-4 py-3 font-semibold tracking-widest flex justify-between items-center text-[12px]">
          <span>GITHUB SYNC</span>
          <button aria-label="Close" onClick={onClose} className="hover:text-red-400 transition-colors">
            <X size={14} strokeWidth={3} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex gap-3 bg-blue-50 border border-blue-100 text-blue-900 p-3">
              <Info size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[12px] font-semibold uppercase tracking-wider">One-time personal setup</p>
                <p className="text-[12px] leading-relaxed">
                  Paste a GitHub token with Gist access. Portfolio Tool will connect to your existing sync Gist when it finds one, or create a private sync Gist from this machine.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Key size={12} /> GitHub Token
              </label>
              <input
                type="password"
                className="w-full border border-slate-300 p-3 font-medium text-sm outline-none focus:bg-slate-50 transition-colors"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="github_pat_..."
                autoComplete="off"
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Use a fine-grained personal access token with only the Gists permission. The token is stored in this browser for personal sync.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(value => !value)}
              className="flex w-full items-center justify-between border border-slate-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors"
              aria-expanded={showAdvanced}
            >
              <span className="flex items-center gap-2"><Database size={12} /> Advanced: use existing Gist</span>
              <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="space-y-2 border border-slate-200 border-t-0 p-3 -mt-3">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <Database size={12} /> Existing Gist ID
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 p-3 font-medium text-sm outline-none focus:bg-slate-50 transition-colors"
                  value={gistId}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (looksLikeGithubToken(nextValue)) {
                      setPat(nextValue.trim());
                      setGistId('');
                      setError('That looks like a GitHub token, so I moved it to the GitHub Token field.');
                      return;
                    }
                    setGistId(nextValue);
                    setError('');
                  }}
                  placeholder="Gist ID or gist.github.com URL"
                />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Only fill this in when connecting another machine to a Gist that Portfolio Tool already created. Leave blank to create a private sync Gist from this machine.
                </p>
              </div>
            )}

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
              {loading ? 'STARTING SYNC...' : 'START SYNCING'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
