import { useStore } from '../store/useStore';
import { Exhibition, Gallery, GalleryKind } from '../types';

export const useMuseumActions = () => {
  const {
    exhibitions, setExhibitions,
    galleries, setGalleries,
    locationMilestones, setLocationMilestones
  } = useStore();

  const createId = () => Math.random().toString(36).slice(2, 11);

  const handleUpdateExhibition = (updatedEx: Exhibition) => {
    setExhibitions(prev => prev.map(ex => (ex.id === updatedEx.id ? updatedEx : ex)));
  };

  const handleRemoveExhibition = (id: string) => {
    if (!window.confirm('PERMANENTLY DELETE THIS PROJECT?')) return;
    setExhibitions(prev => prev.filter(ex => ex.id !== id));
  };

  // Rename a gallery by ID. Cascades the new name to exhibitions and milestones,
  // which still store the gallery NAME (kept as string for back-compat).
  const handleRenameGallery = (id: string, newName: string) => {
    const trimmed = newName.trim().toUpperCase();
    if (!trimmed) return;
    const target = galleries.find(g => g.id === id);
    if (!target) return;
    if (target.name === trimmed) return;
    if (galleries.some(g => g.id !== id && g.name === trimmed)) return;
    const oldName = target.name;
    setGalleries(prev => prev.map(g => g.id === id ? { ...g, name: trimmed } : g));
    setExhibitions(prev => prev.map(ex => ex.gallery === oldName ? { ...ex, gallery: trimmed } : ex));
    setLocationMilestones(prev => prev.map(m => m.gallery === oldName ? { ...m, gallery: trimmed } : m));
  };

  const handleSetGalleryKind = (id: string, kind: GalleryKind) => {
    setGalleries(prev => prev.map(g => g.id === id ? { ...g, kind } : g));
  };

  const handleAddGallery = () => {
    let n = galleries.length + 1;
    let newName = `NEW LOCATION ${n}`;
    while (galleries.some(g => g.name === newName)) {
      n += 1;
      newName = `NEW LOCATION ${n}`;
    }
    const next: Gallery = { id: `gal_${createId()}`, name: newName, kind: 'temporary' };
    setGalleries([...galleries, next]);
  };

  const handleRemoveGallery = (id: string) => {
    if (galleries.length <= 1) return;
    const target = galleries.find(g => g.id === id);
    if (!target) return;
    const remaining = galleries.filter(g => g.id !== id);
    const fallbackName = remaining[0].name;
    setGalleries(remaining);
    setExhibitions(prev => prev.map(ex => ex.gallery === target.name ? { ...ex, gallery: fallbackName } : ex));
    setLocationMilestones(prev => prev.map(m => m.gallery === target.name ? { ...m, gallery: fallbackName } : m));
  };

  const handleDuplicateProject = (id: string) => {
    const source = exhibitions.find(ex => ex.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: createId(),
      title: `${source.title} (COPY)`,
      phases: [...source.phases.map(p => ({ ...p, id: createId() }))]
    };
    setExhibitions([...exhibitions, copy]);
  };

  return {
    handleUpdateExhibition,
    handleRemoveExhibition,
    handleRenameGallery,
    handleSetGalleryKind,
    handleAddGallery,
    handleRemoveGallery,
    handleDuplicateProject
  };
};
