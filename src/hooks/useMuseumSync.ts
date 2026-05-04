import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { CONFIG_STORAGE_KEY, LEGACY_CONFIG_STORAGE_KEYS, MILESTONES_STORAGE_KEY, STORAGE_KEY, DEFAULT_PHASE_TYPES, DEFAULT_GALLERIES } from '../constants';
import { Exhibition, Gallery, LocationMilestone, PhaseType } from '../types';
import { getGistData, updateGistData } from '../lib/githubGist';

const galleryIdFromName = (name: string) => `gal_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || Math.random().toString(36).slice(2, 8)}`;

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

const normalizePhaseTypes = (phaseTypes: PhaseType[] = []): PhaseType[] => {
  const normalizedDefaults = DEFAULT_PHASE_TYPES.map((defaultType) => {
    const matched = phaseTypes.find((phaseType) => (
      phaseType.id === defaultType.id || phaseType.label === defaultType.label
    ));
    if (!matched) return defaultType;
    return {
      ...defaultType,
      ...matched,
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

  const { 
    exhibitions, setExhibitions,
    museumName, setMuseumName,
    galleries, setGalleries,
    phaseTypes, setPhaseTypes,
    locationMilestones, setLocationMilestones
  } = useStore();

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    try {
      const savedEx = localStorage.getItem(STORAGE_KEY);
      if (savedEx) setExhibitions(JSON.parse(savedEx));
      
      const savedMs = localStorage.getItem(MILESTONES_STORAGE_KEY);
      if (savedMs) setLocationMilestones(JSON.parse(savedMs));

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
      localStorage.setItem(MILESTONES_STORAGE_KEY, JSON.stringify(locationMilestones));
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ museumName, galleries, phaseTypes }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [exhibitions, locationMilestones, museumName, galleries, phaseTypes, isInitialLoad]);

  // 3. GitHub Gist Initial Data Pull
  useEffect(() => {
    if (!currentUser || isInitialLoad) return;

    const pullData = async () => {
      try {
        setSyncStatus('syncing');
        const data = await getGistData(currentUser.gistId, currentUser.pat);
        if (data) {
          if (data.museumName) setMuseumName(data.museumName);
          const normalizedGalleries = normalizeGalleries(data.galleries);
          setGalleries(normalizedGalleries);
          if (data.phaseTypes) setPhaseTypes(normalizePhaseTypes(data.phaseTypes));
          if (data.exhibitions) setExhibitions(data.exhibitions);
          if (data.locationMilestones) setLocationMilestones(data.locationMilestones);

          lastSyncedStateRef.current = JSON.stringify({
            museumName: data.museumName || 'NATIONAL HERITAGE TRUST',
            galleries: normalizedGalleries,
            phaseTypes: normalizePhaseTypes(data.phaseTypes || []),
            exhibitions: data.exhibitions || [],
            locationMilestones: data.locationMilestones || []
          });
        }
        setSyncStatus('synced');
      } catch (err) {
        console.error("Gist pull error", err);
        setSyncStatus('error');
      }
    };
    
    // Only pull once when user authenticates
    pullData();
  }, [currentUser]); // Deliberately omit everything else to only run on auth change

  // 4. Auto-save to GitHub Gist when state changes
  useEffect(() => {
    if (!currentUser || isInitialLoad) return;

    const currentState = {
      museumName,
      galleries,
      phaseTypes,
      exhibitions,
      locationMilestones
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
  }, [currentUser, museumName, galleries, phaseTypes, exhibitions, locationMilestones, isInitialLoad]);

  return {
    currentUser,
    setCurrentUser,
    syncStatus,
    setSyncStatus,
    isInitialLoad
  };
};
