import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { CONFIG_STORAGE_KEY, LEGACY_CONFIG_STORAGE_KEYS, LEGACY_MILESTONES_STORAGE_KEYS, STORAGE_KEY, LEGACY_STORAGE_KEYS, DEFAULT_PHASE_TYPES, DEFAULT_GALLERIES, DEFAULT_MILESTONE_COLOR } from '../constants';
import { CheckpointKind, Exhibition, Gallery, PhaseType } from '../types';
import { getGistData, updateGistData } from '../lib/githubGist';

const galleryIdFromName = (name: string) => `gal_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || Math.random().toString(36).slice(2, 8)}`;

const normalizeCheckpointKind = (kind: unknown): CheckpointKind => {
  if (kind === 'deliverable' || kind === 'presentation' || kind === 'external' || kind === 'date') return kind;
  if (kind === 'review' || kind === 'approval') return 'presentation';
  if (kind === 'install') return 'external';
  return 'date';
};

// Accept legacy string[] payloads from localStorage/Gist and upgrade them in place.
const normalizeGalleries = (raw: unknown): Gallery[] => {
  if (!Array.isArray(raw)) return DEFAULT_GALLERIES;
  const seenIds = new Set<string>();
  const result: Gallery[] = [];
  raw.forEach((entry) => {
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (!trimmed) return;
      const matchedDefault = DEFAULT_GALLERIES.find((g) => g.name === trimmed);
      let id = matchedDefault?.id ?? galleryIdFromName(trimmed);
      while (seenIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 5)}`;
      seenIds.add(id);
      result.push({ id, name: trimmed, kind: matchedDefault?.kind ?? 'temporary' });
    } else if (entry && typeof entry === 'object') {
      const obj = entry as Partial<Gallery>;
      const name = (obj.name ?? '').toString().trim();
      if (!name) return;
      let id = obj.id?.toString().trim() || galleryIdFromName(name);
      while (seenIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 5)}`;
      seenIds.add(id);
      const kind: Gallery['kind'] = obj.kind === 'permanent' ? 'permanent' : 'temporary';
      result.push({ id, name, kind });
    }
  });
  return result.length ? result : DEFAULT_GALLERIES;
};

export interface GithubUser {
  pat: string;
  gistId: string;
  displayName: string;
  email: string;
}

const normalizeExhibitions = (raw: unknown): Exhibition[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((ex: any) => {
    const scheduleMode = ex?.scheduleMode === 'single-date' || ex?.isMilestone === true ? 'single-date' : 'range';
    const startDate = (ex?.startDate || '').toString();
    const endDate = scheduleMode === 'single-date' ? startDate : (ex?.endDate || startDate).toString();
    const checkpoints = Array.isArray(ex?.checkpoints)
      ? ex.checkpoints
          .map((checkpoint: any) => ({
            id: (checkpoint?.id || Math.random().toString(36).slice(2, 11)).toString(),
            title: (checkpoint?.title || 'MILESTONE').toString(),
            date: (checkpoint?.date || startDate).toString(),
            kind: normalizeCheckpointKind(checkpoint?.kind),
            color: /^#[0-9a-fA-F]{6}$/.test((checkpoint?.color || '').toString())
              ? checkpoint.color.toString()
              : DEFAULT_MILESTONE_COLOR,
          }))
          .filter((checkpoint) => checkpoint.date)
      : [];
    const { milestones: _milestones, isMilestone: _isMilestone, locationMilestones: _locationMilestones, checkpoints: _checkpoints, ...rest } = ex || {};
    return {
      ...rest,
      startDate,
      endDate,
      scheduleMode,
      checkpoints
    };
  });
};

// Saved colors that should be reset to the current default rather than honored.
// Used after a corrective palette change — e.g. orange (#fba84a) was incorrectly
// shipped for IMPLEMENTATION + DEINSTALL and must be replaced with the museum's
// canonical yellow + red. Add hex values here when the default palette shifts.
const STALE_PHASE_COLORS = new Set(['#fba84a']);

const normalizePhaseTypes = (phaseTypes: PhaseType[] = []): PhaseType[] => {
  const normalizedDefaults = DEFAULT_PHASE_TYPES.map((defaultType) => {
    const matched = phaseTypes.find((phaseType) => (
      phaseType.id === defaultType.id || phaseType.label === defaultType.label
    ));
    if (!matched) return defaultType;
    const savedColor = (matched.color || '').toLowerCase();
    const color = STALE_PHASE_COLORS.has(savedColor) ? defaultType.color : matched.color;
    return {
      ...defaultType,
      ...matched,
      label: defaultType.label,
      color,
      id: defaultType.id,
      isPost: defaultType.isPost,
      isActive: defaultType.isActive
    };
  });
  const customTypes = phaseTypes
    .filter((phaseType) => !DEFAULT_PHASE_TYPES.find((defaultType) => (
      defaultType.id === phaseType.id || defaultType.label === phaseType.label
    )))
    .map((phaseType) => ({
      ...phaseType,
      isPost: phaseType.isPost ?? false,
      isActive: phaseType.isActive ?? false
    }));
  return [...normalizedDefaults, ...customTypes];
};

export const useMuseumSync = () => {
  const [currentUser, setCurrentUser] = useState<GithubUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Track last synced state to prevent redundant saves
  const lastSyncedStateRef = useRef<string | null>(null);
  const hasCompletedInitialGistPullRef = useRef(false);

  const { 
    exhibitions, setExhibitions,
    museumName, setMuseumName,
    galleries, setGalleries,
    phaseTypes, setPhaseTypes
  } = useStore();

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    try {
      let savedEx = localStorage.getItem(STORAGE_KEY);
      if (!savedEx) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacy = localStorage.getItem(legacyKey);
          if (legacy) { savedEx = legacy; break; }
        }
      }
      if (savedEx) setExhibitions(normalizeExhibitions(JSON.parse(savedEx)));

      LEGACY_MILESTONES_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

      let savedCfg = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!savedCfg) {
        // Migrate from older config keys so users don't lose museum name / galleries on upgrade.
        for (const legacyKey of LEGACY_CONFIG_STORAGE_KEYS) {
          const legacy = localStorage.getItem(legacyKey);
          if (legacy) { savedCfg = legacy; break; }
        }
      }
      if (savedCfg) {
        const parsedCfg = JSON.parse(savedCfg);
        if (parsedCfg.museumName) setMuseumName(parsedCfg.museumName);
        setGalleries(normalizeGalleries(parsedCfg.galleries));
        const parsedPhaseTypes = (parsedCfg.phaseTypes || []).filter((phaseType: PhaseType) => phaseType.label !== 'PRODUCTION / FAB');
        setPhaseTypes(normalizePhaseTypes(parsedPhaseTypes));
      }

      // Check for GitHub auth
      const savedPat = localStorage.getItem('github_pat');
      const savedGistId = localStorage.getItem('github_gist_id');
      if (savedPat && savedGistId) {
        setCurrentUser({ pat: savedPat, gistId: savedGistId, displayName: 'GitHub Sync', email: 'Active' });
      }
    } catch (e) {
      console.error("Local load error", e);
    } finally {
      setIsInitialLoad(false);
    }
  }, []);

  // 2. Continuous LocalStorage Backup
  useEffect(() => {
    if (isInitialLoad) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(exhibitions));
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ museumName, galleries, phaseTypes }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [exhibitions, museumName, galleries, phaseTypes, isInitialLoad]);

  // 3. GitHub Gist Initial Data Pull
  useEffect(() => {
    if (!currentUser || isInitialLoad) return;
    hasCompletedInitialGistPullRef.current = false;

    const pullData = async () => {
      try {
        setSyncStatus('syncing');
        const data = await getGistData(currentUser.gistId, currentUser.pat);
        if (!data) {
          throw new Error('This Gist does not contain Portfolio Tool timeline data. Use the Gist ID created by Portfolio Tool on the laptop that has your timeline.');
        }

        const normalizedState = {
          museumName: data.museumName || 'NATIONAL HERITAGE TRUST',
          galleries: normalizeGalleries(data.galleries),
          phaseTypes: normalizePhaseTypes(data.phaseTypes || []),
          exhibitions: normalizeExhibitions(data.exhibitions)
        };

        setMuseumName(normalizedState.museumName);
        setGalleries(normalizedState.galleries);
        setPhaseTypes(normalizedState.phaseTypes);
        setExhibitions(normalizedState.exhibitions);

        lastSyncedStateRef.current = JSON.stringify(normalizedState);
        hasCompletedInitialGistPullRef.current = true;
        setSyncStatus('synced');
      } catch (err) {
        console.error("Gist pull error", err);
        hasCompletedInitialGistPullRef.current = false;
        setSyncStatus('error');
      }
    };
    
    // Only pull once when user authenticates
    pullData();
  }, [currentUser]); // Deliberately omit everything else to only run on auth change

  // 4. Auto-save to GitHub Gist when state changes
  useEffect(() => {
    if (!currentUser || isInitialLoad) return;
    if (!hasCompletedInitialGistPullRef.current) return;

    const currentState = {
      museumName,
      galleries,
      phaseTypes,
      exhibitions
    };
    const serializedState = JSON.stringify(currentState);
    
    // Don't save if state hasn't changed from last sync
    if (lastSyncedStateRef.current === serializedState) return;

    const timeout = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        await updateGistData(currentUser.gistId, currentUser.pat, currentState);
        lastSyncedStateRef.current = serializedState;
        setSyncStatus('synced');
      } catch (err) {
        console.error("Gist save error", err);
        setSyncStatus('error');
      }
    }, 1500); // 1.5s debounce to avoid spamming GitHub API

    return () => clearTimeout(timeout);
  }, [currentUser, museumName, galleries, phaseTypes, exhibitions, isInitialLoad]);

  return {
    currentUser,
    setCurrentUser,
    syncStatus,
    setSyncStatus,
    isInitialLoad
  };
};
